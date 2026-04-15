import { prisma } from '../types/index.js';
import { ok, created, err } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Router } from 'express';
import { z } from 'zod';
const router = Router();
const createPostSchema = z.object({ content: z.string().min(1).max(5000), topic_ids: z.array(z.number()).optional() });
const updatePostSchema = z.object({ content: z.string().min(1).max(5000).optional(), topic_ids: z.array(z.number()).optional() });
const createCommentSchema = z.object({ content: z.string().min(1).max(1000), parent_id: z.number().optional() });
// ─── Hashtag extraction ─────────────────────────────────────────────────────
function extractHashtags(content) {
    const matches = content.match(/#[\w\u00C0-\u024F\u1EA0-\u1EF9]+/g);
    return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : [];
}
function safeCursor(req) { return typeof req.query.cursor === 'string' ? req.query.cursor : undefined; }
function safeLimit(req) { return Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50); }
function buildPostResponse(p, feed_score = 0) {
    return {
        id: p.id, content: p.content, author_id: p.authorId, created_at: p.createdAt, updated_at: p.updatedAt,
        likes_count: p.likesCount, comments_count: p.commentsCount,
        topics: p.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
        author: { id: p.author.id, username: p.author.username, email: p.author.email, date_of_birth: p.author.dateOfBirth, is_admin: p.author.isAdmin, created_at: p.author.createdAt },
        feed_score,
    };
}
router.get('/feed', withAuth(async (req, res) => {
    const u = getUser(req);
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const [prefs, following] = await Promise.all([
        prisma.userPreference.findUnique({ where: { userId: u.id } }),
        prisma.follow.findMany({ where: { followerId: u.id }, select: { followingId: true } }),
    ]);
    const preferredTopicIds = prefs?.topicIds || [];
    const followingIds = following.map((f) => f.followingId);
    const posts = await prisma.post.findMany({
        where: cursor ? { createdAt: { lt: new Date(cursor) } } : {},
        orderBy: { createdAt: 'desc' }, take: limit + 1,
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit).map((p) => {
        let score = followingIds.includes(p.authorId) ? 1 : 0;
        if (p.topics.map((pt) => pt.topicId).some((id) => preferredTopicIds.includes(id)))
            score += 2;
        return buildPostResponse(p, score);
    });
    items.sort((a, b) => b.feed_score - a.feed_score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));
router.get('/explore', withAuth(async (req, res) => {
    const topicId = typeof req.query.topic_id === 'string' ? parseInt(req.query.topic_id, 10) : null;
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const whereCond = {};
    if (topicId)
        whereCond.topics = { some: { topicId } };
    if (cursor)
        whereCond.createdAt = { lt: new Date(cursor) };
    const posts = await prisma.post.findMany({
        where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1,
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit).map((p) => buildPostResponse(p));
    return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));
router.get('/search', withAuth(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const whereCond = { content: { contains: q, mode: 'insensitive' } };
    if (cursor)
        whereCond.createdAt = { lt: new Date(cursor) };
    const posts = await prisma.post.findMany({
        where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1,
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit).map((p) => buildPostResponse(p));
    return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));
router.post('/', validate(createPostSchema), withAuth(async (req, res) => {
    const u = getUser(req);
    const { content, topic_ids } = req.body;
    const post = await prisma.post.create({
        data: { content, authorId: u.id },
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    if (topic_ids?.length)
        await prisma.postTopic.createMany({ data: topic_ids.map((tid) => ({ postId: post.id, topicId: tid })), skipDuplicates: true });
    // Extract & update hashtags
    const hashtags = extractHashtags(content);
    await Promise.all(hashtags.map((name) => prisma.hashtag.upsert({
        where: { name },
        create: { name, postCount: 1 },
        update: { postCount: { increment: 1 } },
    })));
    const refreshed = await prisma.post.findUnique({
        where: { id: post.id },
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    return created(res, buildPostResponse(refreshed));
}));
router.get('/:id', withAuth(async (req, res) => {
    const post = await prisma.post.findUnique({
        where: { id: paramId(req, 'id') },
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    if (!post)
        return err(res, 404, 'Post not found');
    return ok(res, buildPostResponse(post));
}));
router.put('/:id', validate(updatePostSchema), withAuth(async (req, res) => {
    const u = getUser(req);
    const postId = paramId(req, 'id');
    const { content, topic_ids } = req.body;
    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing)
        return err(res, 404, 'Post not found');
    if (existing.authorId !== u.id)
        return err(res, 403, 'Not authorized');
    await prisma.post.update({ where: { id: postId }, data: { content: content ?? existing.content } });
    if (topic_ids !== undefined) {
        await prisma.postTopic.deleteMany({ where: { postId } });
        if (topic_ids.length)
            await prisma.postTopic.createMany({ data: topic_ids.map((tid) => ({ postId, topicId: tid })) });
    }
    const refreshed = await prisma.post.findUnique({
        where: { id: postId },
        include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
    });
    return ok(res, buildPostResponse(refreshed));
}));
router.delete('/:id', withAuth(async (req, res) => {
    const u = getUser(req);
    const postId = paramId(req, 'id');
    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing)
        return err(res, 404, 'Post not found');
    if (existing.authorId !== u.id)
        return err(res, 403, 'Not authorized');
    await prisma.post.delete({ where: { id: postId } });
    res.sendStatus(204);
}));
router.get('/:id/comments', withAuth(async (req, res) => {
    const postId = paramId(req, 'id');
    const cursor = typeof req.query.cursor === 'string' ? parseInt(req.query.cursor, 10) : undefined;
    const limit = safeLimit(req);
    const comments = await prisma.comment.findMany({
        where: { postId, ...(cursor !== undefined ? { id: { gt: cursor } } : {}) },
        orderBy: { id: 'asc' }, take: limit + 1,
        include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true } } },
    });
    const hasMore = comments.length > limit;
    const items = comments.slice(0, limit).map((c) => ({
        id: c.id, content: c.content, post_id: c.postId, author_id: c.authorId, parent_id: c.parentId, created_at: c.createdAt,
        author: { id: c.author.id, username: c.author.username, email: c.author.email, avatar_url: c.author.avatarUrl, created_at: c.author.createdAt },
    }));
    return ok(res, { comments: items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null });
}));
router.post('/:id/comments', validate(createCommentSchema), withAuth(async (req, res) => {
    const u = getUser(req);
    const postId = paramId(req, 'id');
    const { content, parent_id } = req.body;
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post)
        return err(res, 404, 'Post not found');
    const comment = await prisma.comment.create({
        data: { content, postId, authorId: u.id, parentId: parent_id || null },
        include: { author: { select: { id: true, username: true, email: true, createdAt: true } } },
    });
    await prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
    if (post.authorId !== u.id) {
        await prisma.notification.create({ data: { userId: post.authorId, type: 'comment', data: { actor_id: u.id, actor_username: u.username, post_id: postId }, actorAvatarUrl: u.avatar_url || null } });
    }
    return created(res, { id: comment.id, content: comment.content, post_id: comment.postId, author_id: comment.authorId, parent_id: comment.parentId, created_at: comment.createdAt, author: { id: comment.author.id, username: comment.author.username, email: comment.author.email, created_at: comment.author.createdAt } });
}));
// ─── Trending hashtags (top N by post count in last 7 days) ──────────────────
router.get('/trending/hashtags', withAuth(async (_req, res) => {
    const limit = Math.min(parseInt(typeof _req.query.limit === 'string' ? _req.query.limit : '10', 10), 20);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hashtags = await prisma.hashtag.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { postCount: 'desc' },
        take: limit,
    });
    return ok(res, hashtags.map((h) => ({ id: h.id, name: h.name, post_count: h.postCount })));
}));
export default router;
