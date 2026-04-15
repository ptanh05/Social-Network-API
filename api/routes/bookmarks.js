import { prisma } from '../types/index.js';
import { ok, created, err } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { Router } from 'express';
const router = Router();
function safeCursor(req) { return typeof req.query.cursor === 'string' ? req.query.cursor : undefined; }
function safeLimit(req) { return Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50); }
router.get('/', withAuth(async (req, res) => {
    const u = getUser(req);
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const whereCond = { userId: u.id };
    if (cursor)
        whereCond.createdAt = { lt: new Date(cursor) };
    const bookmarks = await prisma.bookmark.findMany({
        where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1,
        include: { post: { include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } } },
    });
    const hasMore = bookmarks.length > limit;
    const posts = bookmarks.slice(0, limit).map((b) => ({
        id: b.post.id, content: b.post.content, author_id: b.post.authorId, created_at: b.post.createdAt, updated_at: b.post.updatedAt, likes_count: b.post.likesCount, comments_count: b.post.commentsCount,
        topics: b.post.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
        author: { id: b.post.author.id, username: b.post.author.username, email: b.post.author.email, date_of_birth: b.post.author.dateOfBirth, is_admin: b.post.author.isAdmin, created_at: b.post.author.createdAt },
    }));
    return ok(res, { posts, next_cursor: hasMore && bookmarks.length > 0 ? String(bookmarks[bookmarks.length - 1]?.createdAt) : null });
}));
router.get('/posts/:id/status', withAuth(async (req, res) => {
    const u = getUser(req);
    const bookmark = await prisma.bookmark.findUnique({ where: { userId_postId: { userId: u.id, postId: paramId(req, 'id') } } });
    return ok(res, { bookmarked: !!bookmark });
}));
router.post('/posts/:id', withAuth(async (req, res) => {
    const u = getUser(req);
    const postId = paramId(req, 'id');
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post)
        return err(res, 404, 'Post not found');
    try {
        await prisma.bookmark.create({ data: { userId: u.id, postId } });
        return created(res, { bookmarked: true });
    }
    catch (e) {
        if (e.code === 'P2002')
            return err(res, 400, 'Already bookmarked');
        throw e;
    }
}));
router.delete('/posts/:id', withAuth(async (req, res) => {
    const u = getUser(req);
    const result = await prisma.bookmark.deleteMany({ where: { userId: u.id, postId: paramId(req, 'id') } });
    if (!result.count)
        return err(res, 404, 'Bookmark not found');
    return ok(res, { bookmarked: false });
}));
export default router;
