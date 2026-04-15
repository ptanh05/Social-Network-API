import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma, AuthUser, AuthRequest } from './dist/types/index.js';
import { hashPassword, verifyPassword } from './dist/lib/bcrypt.js';
import { signAccessToken, signRefreshToken, verifyToken } from './dist/lib/jwt.js';
import { ok, created, err, noContent } from './dist/lib/utils.js';
import { z } from 'zod';
import { withLoginLimit } from './dist/middleware/rateLimit.js';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://social-network-api-mu.vercel.app',
  ],
  credentials: true,
}));
app.use(express.json());

// ─── Helpers ─────────────────────────────────────────────────────
function paramId(req: express.Request, name: string): number {
  const val = req.params[name];
  return parseInt(Array.isArray(val) ? val[0] : val as string, 10);
}
function getUser(req: AuthRequest): AuthUser { return req.user!; }

function withAuth(handler: (req: AuthRequest, res: express.Response) => Promise<void>) {
  return async (req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return err(res, 401, 'Missing or invalid authorization header');
    const payload = verifyToken(auth.slice(7));
    if (!payload || payload.type !== 'access') return err(res, 401, 'Invalid or expired access token');
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, username: true, email: true, isAdmin: true, avatarUrl: true },
    });
    if (!user) return err(res, 401, 'User not found');
    (req as AuthRequest).user = {
      id: user.id, username: user.username, email: user.email,
      is_admin: user.isAdmin, avatar_url: user.avatarUrl,
    };
    await handler(req as AuthRequest, res);
  };
}

function withAdmin(handler: (req: AuthRequest, res: express.Response) => Promise<void>) {
  return withAuth(async (req: AuthRequest, res: express.Response) => {
    if (!req.user?.is_admin) return err(res, 403, 'Admin access required');
    await handler(req, res);
  });
}

function safeCursor(req: express.Request): string | undefined {
  return typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
}
function safeLimit(req: express.Request): number {
  return Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50);
}

// ─── Validate middleware ──────────────────────────────────────────
function validate(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.errors[0].message);
    next();
  };
}

// ─── Schemas ──────────────────────────────────────────────────────
const registerSchema = z.object({ username: z.string().regex(/^[a-zA-Z0-9_]{4,20}$/).min(4).max(20), email: z.string().email(), password: z.string().min(8), date_of_birth: z.string().optional() });
const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
const refreshSchema = z.object({ refresh_token: z.string().min(1) });
const updateMeSchema = z.object({ username: z.string().regex(/^[a-zA-Z0-9_]{4,20}$/).optional(), date_of_birth: z.string().optional(), avatar_url: z.string().url().optional().or(z.literal('')) });
const createPostSchema = z.object({ content: z.string().min(1).max(5000), topic_ids: z.array(z.number()).optional() });
const updatePostSchema = z.object({ content: z.string().min(1).max(5000).optional(), topic_ids: z.array(z.number()).optional() });
const createCommentSchema = z.object({ content: z.string().min(1).max(1000), parent_id: z.number().optional() });
const updatePrefsSchema = z.object({ topic_ids: z.array(z.number()) });
const createReportSchema = z.object({ target_type: z.enum(['post', 'comment', 'user']), target_id: z.number().int().positive(), reason: z.string().min(5).max(1000) });

// ─── Auth ────────────────────────────────────────────────────────
app.post('/api/v1/auth/register', validate(registerSchema), async (req, res) => {
  const body = req.body as { username: string; email: string; password: string; date_of_birth?: string };
  try {
    const user = await prisma.user.create({
      data: { username: body.username, email: body.email, hashedPassword: await hashPassword(body.password), dateOfBirth: body.date_of_birth ? new Date(body.date_of_birth) : null },
      select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true },
    });
    return created(res, { id: user.id, username: user.username, email: user.email, date_of_birth: user.dateOfBirth, is_admin: user.isAdmin, created_at: user.createdAt });
  } catch (e: unknown) {
    const e2 = e as { code?: string; meta?: { target?: string[] } };
    if (e2.code === 'P2002') return err(res, 400, `${e2.meta?.target?.[0]?.includes('username') ? 'Username' : 'Email'} already registered`);
    return err(res, 500, 'Registration failed');
  }
});

app.post('/api/v1/auth/login', validate(loginSchema), async (req, res) => {
  const body = req.body as { username: string; password: string };
  const user = await prisma.user.findUnique({ where: { username: body.username } });
  if (!user) return err(res, 401, 'Incorrect username or password');
  if (!await verifyPassword(body.password, user.hashedPassword)) return err(res, 401, 'Incorrect username or password');
  const access_token = signAccessToken(user.id);
  const refresh_token = signRefreshToken(user.id);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: await hashPassword(refresh_token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  return ok(res, { access_token, refresh_token, token_type: 'bearer', expires_in: 600 });
});

app.post('/api/v1/auth/refresh', validate(refreshSchema), async (req, res) => {
  const { refresh_token } = req.body as { refresh_token: string };
  const payload = verifyToken(refresh_token);
  if (!payload || payload.type !== 'refresh') return err(res, 401, 'Invalid refresh token');
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user) return err(res, 401, 'User not found');
  const newAccessToken = signAccessToken(user.id);
  const newRefreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: await hashPassword(newRefreshToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  return ok(res, { access_token: newAccessToken, refresh_token: newRefreshToken, token_type: 'bearer', expires_in: 600 });
});

app.post('/api/v1/auth/logout', async (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload && payload.type === 'access') await prisma.refreshToken.deleteMany({ where: { userId: Number(payload.sub) } });
  }
  return ok(res, { success: true });
});

// ─── Users ──────────────────────────────────────────────────────
app.get('/api/v1/users/me', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  return ok(res, { id: u.id, username: u.username, email: u.email, avatar_url: u.avatar_url, date_of_birth: null, is_admin: u.is_admin, created_at: new Date() });
}));

app.put('/api/v1/users/me', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const body = req.body as { username?: string; date_of_birth?: string; avatar_url?: string };
  if (body.username !== undefined) {
    const existing = await prisma.user.findFirst({ where: { username: body.username, id: { not: u.id } } });
    if (existing) return err(res, 400, 'Username already taken');
  }
  const updated = await prisma.user.update({
    where: { id: u.id },
    data: { username: body.username ?? undefined, dateOfBirth: body.date_of_birth ? new Date(body.date_of_birth) : undefined, avatarUrl: body.avatar_url ?? undefined },
    select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true },
  });
  return ok(res, { id: updated.id, username: updated.username, email: updated.email, avatar_url: updated.avatarUrl, date_of_birth: updated.dateOfBirth, is_admin: updated.isAdmin, created_at: updated.createdAt });
}));

app.delete('/api/v1/users/me', withAuth(async (req: AuthRequest, res) => {
  await prisma.user.delete({ where: { id: getUser(req).id } });
  return ok(res, { success: true });
}));

app.get('/api/v1/users/search', withAuth(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q) return ok(res, []);
  const users = await prisma.user.findMany({ where: { username: { contains: q, mode: 'insensitive' } }, select: { id: true, username: true, email: true, createdAt: true }, take: 20 });
  return ok(res, users);
}));

app.get('/api/v1/users/:id', withAuth(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: paramId(req, 'id') }, select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } });
  if (!user) return err(res, 404, 'User not found');
  return ok(res, { id: user.id, username: user.username, email: user.email, avatar_url: user.avatarUrl, date_of_birth: user.dateOfBirth, is_admin: user.isAdmin, created_at: user.createdAt });
}));

app.get('/api/v1/users/:id/profile', withAuth(async (req, res) => {
  const id = paramId(req, 'id');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } });
  if (!user) return err(res, 404, 'User not found');
  const [followers_count, following_count, posts_count] = await Promise.all([
    prisma.follow.count({ where: { followingId: id } }),
    prisma.follow.count({ where: { followerId: id } }),
    prisma.post.count({ where: { authorId: id } }),
  ]);
  return ok(res, { id: user.id, username: user.username, email: user.email, avatar_url: user.avatarUrl, date_of_birth: user.dateOfBirth, is_admin: user.isAdmin, created_at: user.createdAt, followers_count, following_count, posts_count });
}));

app.get('/api/v1/users/:id/posts', withAuth(async (req, res) => {
  const userId = paramId(req, 'id');
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: { authorId: number; createdAt?: { lt: Date } } = { authorId: userId };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const posts = await prisma.post.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => ({
    id: p.id, content: p.content, author_id: p.authorId, created_at: p.createdAt, updated_at: p.updatedAt, likes_count: p.likesCount, comments_count: p.commentsCount,
    topics: p.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
    author: { id: p.author.id, username: p.author.username, email: p.author.email, date_of_birth: p.author.dateOfBirth, is_admin: p.author.isAdmin, created_at: p.author.createdAt },
  }));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));

app.post('/api/v1/users/me/change-password', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const { current_password, new_password } = req.body as { current_password: string; new_password: string };
  if (!current_password || !new_password) return err(res, 400, 'current_password and new_password are required');
  const user = await prisma.user.findUnique({ where: { id: u.id } });
  if (!user) return err(res, 401, 'User not found');
  if (!await verifyPassword(current_password, user.hashedPassword)) return err(res, 400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { hashedPassword: await hashPassword(new_password) } });
  return ok(res, { success: true });
}));

// ─── Posts ───────────────────────────────────────────────────────
function extractHashtags(content: string): string[] {
  const matches = content.match(/#[\w\u00C0-\u024F\u1EA0-\u1EF9]+/g);
  return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : [];
}

function buildPostResponse(p: { id: number; content: string; authorId: number; createdAt: Date; updatedAt: Date; likesCount: number; commentsCount: number; author: { id: number; username: string; email: string; dateOfBirth: unknown; isAdmin: boolean; createdAt: Date }; topics: Array<{ topic: { id: number; name: string; description: unknown } }> }, feed_score = 0) {
  return { id: p.id, content: p.content, author_id: p.authorId, created_at: p.createdAt, updated_at: p.updatedAt, likes_count: p.likesCount, comments_count: p.commentsCount, topics: p.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })), author: { id: p.author.id, username: p.author.username, email: p.author.email, date_of_birth: p.author.dateOfBirth, is_admin: p.author.isAdmin, created_at: p.author.createdAt }, feed_score };
}

app.get('/api/v1/posts/feed', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const [prefs, following] = await Promise.all([prisma.userPreference.findUnique({ where: { userId: u.id } }), prisma.follow.findMany({ where: { followerId: u.id }, select: { followingId: true } })]);
  const preferredTopicIds = prefs?.topicIds || [];
  const followingIds = following.map((f) => f.followingId);
  const posts = await prisma.post.findMany({ where: cursor ? { createdAt: { lt: new Date(cursor) } } : {}, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => {
    let score = followingIds.includes(p.authorId) ? 1 : 0;
    if (p.topics.map((pt) => pt.topicId).some((id) => preferredTopicIds.includes(id))) score += 2;
    return buildPostResponse(p, score);
  });
  items.sort((a, b) => b.feed_score - a.feed_score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));

app.get('/api/v1/posts/explore', withAuth(async (req, res) => {
  const topicId = typeof req.query.topic_id === 'string' ? parseInt(req.query.topic_id, 10) : null;
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: Record<string, unknown> = {};
  if (topicId) whereCond.topics = { some: { topicId } };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const posts = await prisma.post.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => buildPostResponse(p));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));

app.get('/api/v1/posts/search', withAuth(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: Record<string, unknown> = { content: { contains: q, mode: 'insensitive' } };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const posts = await prisma.post.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => buildPostResponse(p));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));

app.post('/api/v1/posts', validate(createPostSchema), withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const { content, topic_ids } = req.body as { content: string; topic_ids?: number[] };
  const post = await prisma.post.create({ data: { content, authorId: u.id }, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  if (topic_ids?.length) await prisma.postTopic.createMany({ data: topic_ids.map((tid) => ({ postId: post.id, topicId: tid })), skipDuplicates: true });
  const hashtags = extractHashtags(content);
  await Promise.all(hashtags.map((name) => prisma.hashtag.upsert({ where: { name }, create: { name, postCount: 1 }, update: { postCount: { increment: 1 } } })));
  const refreshed = await prisma.post.findUnique({ where: { id: post.id }, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  return created(res, buildPostResponse(refreshed!));
}));

app.get('/api/v1/posts/:id', withAuth(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: paramId(req, 'id') }, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  if (!post) return err(res, 404, 'Post not found');
  return ok(res, buildPostResponse(post));
}));

app.put('/api/v1/posts/:id', validate(updatePostSchema), withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const { content, topic_ids } = req.body as { content?: string; topic_ids?: number[] };
  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) return err(res, 404, 'Post not found');
  if (existing.authorId !== u.id) return err(res, 403, 'Not authorized');
  await prisma.post.update({ where: { id: postId }, data: { content: content ?? existing.content } });
  if (topic_ids !== undefined) {
    await prisma.postTopic.deleteMany({ where: { postId } });
    if (topic_ids.length) await prisma.postTopic.createMany({ data: topic_ids.map((tid) => ({ postId, topicId: tid })) });
  }
  const refreshed = await prisma.post.findUnique({ where: { id: postId }, include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  return ok(res, buildPostResponse(refreshed!));
}));

app.delete('/api/v1/posts/:id', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) return err(res, 404, 'Post not found');
  if (existing.authorId !== u.id) return err(res, 403, 'Not authorized');
  await prisma.post.delete({ where: { id: postId } });
  return res.sendStatus(204);
}));

app.get('/api/v1/posts/:id/comments', withAuth(async (req, res) => {
  const postId = paramId(req, 'id');
  const cursor = typeof req.query.cursor === 'string' ? parseInt(req.query.cursor, 10) : undefined;
  const limit = safeLimit(req);
  const comments = await prisma.comment.findMany({ where: { postId, ...(cursor !== undefined ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true } } } });
  const hasMore = comments.length > limit;
  const items = comments.slice(0, limit).map((c) => ({ id: c.id, content: c.content, post_id: c.postId, author_id: c.authorId, parent_id: c.parentId, created_at: c.createdAt, author: { id: c.author.id, username: c.author.username, email: c.author.email, avatar_url: c.author.avatarUrl, created_at: c.author.createdAt } }));
  return ok(res, { comments: items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null });
}));

app.post('/api/v1/posts/:id/comments', validate(createCommentSchema), withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const { content, parent_id } = req.body as { content: string; parent_id?: number };
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) return err(res, 404, 'Post not found');
  const comment = await prisma.comment.create({ data: { content, postId, authorId: u.id, parentId: parent_id || null }, include: { author: { select: { id: true, username: true, email: true, createdAt: true } } } });
  await prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
  if (post.authorId !== u.id) await prisma.notification.create({ data: { userId: post.authorId, type: 'comment', data: { actor_id: u.id, actor_username: u.username, post_id: postId }, actorAvatarUrl: u.avatar_url || null } });
  return created(res, { id: comment.id, content: comment.content, post_id: comment.postId, author_id: comment.authorId, parent_id: comment.parentId, created_at: comment.createdAt, author: { id: comment.author.id, username: comment.author.username, email: comment.author.email, created_at: comment.author.createdAt } });
}));

app.get('/api/v1/posts/trending/hashtags', withAuth(async (req, res) => {
  const limit = Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '10', 10), 20);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hashtags = await prisma.hashtag.findMany({ where: { createdAt: { gte: since } }, orderBy: { postCount: 'desc' }, take: limit });
  return ok(res, hashtags.map((h) => ({ id: h.id, name: h.name, post_count: h.postCount })));
}));

// ─── Likes ───────────────────────────────────────────────────────
app.post('/api/v1/likes/posts/:id/like', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) return err(res, 404, 'Post not found');
  try {
    await prisma.like.create({ data: { userId: u.id, postId } });
    await prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
    if (post.authorId !== u.id) await prisma.notification.create({ data: { userId: post.authorId, type: 'like', data: { actor_id: u.id, actor_username: u.username, post_id: postId }, actorAvatarUrl: u.avatar_url || null } });
    return created(res, { liked: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return err(res, 400, 'Already liked');
    throw e;
  }
}));

app.delete('/api/v1/likes/posts/:id/like', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const result = await prisma.like.deleteMany({ where: { userId: u.id, postId } });
  if (!result.count) return err(res, 404, 'Like not found');
  await prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
  return ok(res, { liked: false });
}));

app.get('/api/v1/likes/posts/:id/status', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const like = await prisma.like.findUnique({ where: { userId_postId: { userId: u.id, postId: paramId(req, 'id') } } });
  return ok(res, { liked: !!like });
}));

// ─── Follows ─────────────────────────────────────────────────────
app.get('/api/v1/follows/users/:id/followers', withAuth(async (req, res) => {
  const userId = paramId(req, 'id');
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: Record<string, unknown> = { followingId: userId };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const follows = await prisma.follow.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { follower: { select: { id: true, username: true, email: true, createdAt: true } } } });
  const hasMore = follows.length > limit;
  const items = follows.slice(0, limit).map((f) => ({ id: f.follower.id, username: f.follower.username, email: f.follower.email, created_at: f.follower.createdAt }));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(follows[follows.length - 1]?.createdAt) : null });
}));

app.get('/api/v1/follows/users/:id/following', withAuth(async (req, res) => {
  const userId = paramId(req, 'id');
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: Record<string, unknown> = { followerId: userId };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const follows = await prisma.follow.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { following: { select: { id: true, username: true, email: true, createdAt: true } } } });
  const hasMore = follows.length > limit;
  const items = follows.slice(0, limit).map((f) => ({ id: f.following.id, username: f.following.username, email: f.following.email, created_at: f.following.createdAt }));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(follows[follows.length - 1]?.createdAt) : null });
}));

app.get('/api/v1/follows/users/:id/status', withAuth(async (req, res) => {
  const u = getUser(req);
  const follow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: u.id, followingId: paramId(req, 'id') } } });
  return ok(res, { following: !!follow });
}));

app.post('/api/v1/follows/users/:id/follow', withAuth(async (req: AuthRequest, res) => {
  const me = getUser(req);
  const targetId = paramId(req, 'id');
  if (me.id === targetId) return err(res, 400, 'Cannot follow yourself');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return err(res, 404, 'User not found');
  try {
    await prisma.follow.create({ data: { followerId: me.id, followingId: targetId } });
    await prisma.notification.create({ data: { userId: targetId, type: 'follow', data: { actor_id: me.id, actor_username: me.username }, actorAvatarUrl: me.avatar_url || null } });
    return created(res, { following: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return err(res, 400, 'Already following');
    throw e;
  }
}));

app.delete('/api/v1/follows/users/:id/follow', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const result = await prisma.follow.deleteMany({ where: { followerId: u.id, followingId: paramId(req, 'id') } });
  if (!result.count) return err(res, 404, 'Not following');
  return ok(res, { following: false });
}));

// ─── Topics ──────────────────────────────────────────────────────
app.get('/api/v1/topics', withAuth(async (_req, res) => {
  const topics = await prisma.topic.findMany({ orderBy: { id: 'asc' } });
  return ok(res, topics.map((t) => ({ id: t.id, name: t.name, description: t.description })));
}));

// ─── Preferences ─────────────────────────────────────────────────
app.get('/api/v1/preferences/users/me/preferences', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const pref = await prisma.userPreference.findUnique({ where: { userId: u.id } });
  const topicIds = pref?.topicIds || [];
  const topics = await prisma.topic.findMany({ where: { id: { in: topicIds } } });
  return ok(res, { topics: topics.map((t) => ({ id: t.id, name: t.name, description: t.description })) });
}));

app.put('/api/v1/preferences/users/me/preferences', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const { topic_ids } = req.body as { topic_ids: number[] };
  const existing = await prisma.userPreference.findUnique({ where: { userId: u.id } });
  if (existing) await prisma.userPreference.update({ where: { userId: u.id }, data: { topicIds: topic_ids } });
  else await prisma.userPreference.create({ data: { userId: u.id, topicIds: topic_ids } });
  const topics = await prisma.topic.findMany({ where: { id: { in: topic_ids } } });
  return ok(res, { topics: topics.map((t) => ({ id: t.id, name: t.name, description: t.description })) });
}));

// ─── Notifications ───────────────────────────────────────────────
app.get('/api/v1/notifications', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const notifications = await prisma.notification.findMany({ where: { userId: u.id, ...(cursor ? { id: { lt: parseInt(cursor, 10) } } : {}) }, orderBy: { id: 'desc' }, take: limit + 1 });
  const hasMore = notifications.length > limit;
  const items = notifications.slice(0, limit);
  return ok(res, { notifications: items.map((n) => ({ id: n.id, user_id: n.userId, type: n.type, data: n.data, actor_avatar_url: n.actorAvatarUrl, is_read: n.isRead, created_at: n.createdAt })), next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null });
}));

app.get('/api/v1/notifications/unread-count', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const count = await prisma.notification.count({ where: { userId: u.id, isRead: false } });
  return ok(res, { count });
}));

app.put('/api/v1/notifications/:id/read', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  await prisma.notification.updateMany({ where: { id: paramId(req, 'id'), userId: u.id }, data: { isRead: true } });
  return noContent(res);
}));

app.put('/api/v1/notifications/read-all', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  await prisma.notification.updateMany({ where: { userId: u.id }, data: { isRead: true } });
  return noContent(res);
}));

// ─── Bookmarks ───────────────────────────────────────────────────
app.get('/api/v1/bookmarks', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: Record<string, unknown> = { userId: u.id };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const bookmarks = await prisma.bookmark.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { post: { include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } } } });
  const hasMore = bookmarks.length > limit;
  const posts = bookmarks.slice(0, limit).map((b) => ({
    id: b.post.id, content: b.post.content, author_id: b.post.authorId, created_at: b.post.createdAt, updated_at: b.post.updatedAt, likes_count: b.post.likesCount, comments_count: b.post.commentsCount,
    topics: b.post.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
    author: { id: b.post.author.id, username: b.post.author.username, email: b.post.author.email, date_of_birth: b.post.author.dateOfBirth, is_admin: b.post.author.isAdmin, created_at: b.post.author.createdAt },
  }));
  return ok(res, { posts, next_cursor: hasMore && bookmarks.length > 0 ? String(bookmarks[bookmarks.length - 1]?.createdAt) : null });
}));

app.get('/api/v1/bookmarks/posts/:id/status', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const bookmark = await prisma.bookmark.findUnique({ where: { userId_postId: { userId: u.id, postId: paramId(req, 'id') } } });
  return ok(res, { bookmarked: !!bookmark });
}));

app.post('/api/v1/bookmarks/posts/:id', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return err(res, 404, 'Post not found');
  try {
    await prisma.bookmark.create({ data: { userId: u.id, postId } });
    return created(res, { bookmarked: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return err(res, 400, 'Already bookmarked');
    throw e;
  }
}));

app.delete('/api/v1/bookmarks/posts/:id', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const result = await prisma.bookmark.deleteMany({ where: { userId: u.id, postId: paramId(req, 'id') } });
  if (!result.count) return err(res, 404, 'Bookmark not found');
  return ok(res, { bookmarked: false });
}));

// ─── Reports ─────────────────────────────────────────────────────
app.post('/api/v1/reports', validate(createReportSchema), withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const { target_type, target_id, reason } = req.body as { target_type: string; target_id: number; reason: string };
  if (target_type === 'post') { const post = await prisma.post.findUnique({ where: { id: target_id }, select: { id: true, authorId: true } }); if (!post) return err(res, 404, 'Post not found'); if (post.authorId === u.id) return err(res, 400, 'Cannot report your own post'); }
  else if (target_type === 'comment') { const comment = await prisma.comment.findUnique({ where: { id: target_id }, select: { id: true, authorId: true } }); if (!comment) return err(res, 404, 'Comment not found'); if (comment.authorId === u.id) return err(res, 400, 'Cannot report your own comment'); }
  else if (target_type === 'user') { if (target_id === u.id) return err(res, 400, 'Cannot report yourself'); const user = await prisma.user.findUnique({ where: { id: target_id }, select: { id: true } }); if (!user) return err(res, 404, 'User not found'); }
  const report = await prisma.report.create({ data: { reporterId: u.id, targetType: target_type, targetId: target_id, reason }, select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true } });
  return created(res, { id: report.id, target_type: report.targetType, target_id: report.targetId, reason: report.reason, status: report.status, created_at: report.createdAt });
}));

app.get('/api/v1/reports', withAdmin(async (req: AuthRequest, res) => {
  const cursor = typeof req.query.cursor === 'string' ? parseInt(req.query.cursor, 10) : undefined;
  const limit = Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50);
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const whereCond: Record<string, unknown> = { status };
  if (cursor !== undefined) whereCond.id = { lt: cursor };
  const reports = await prisma.report.findMany({ where: whereCond, orderBy: { id: 'desc' }, take: limit + 1, include: { reporter: { select: { id: true, username: true, email: true } } } });
  const hasMore = reports.length > limit;
  const items = reports.slice(0, limit).map((r) => ({ id: r.id, target_type: r.targetType, target_id: r.targetId, reason: r.reason, status: r.status, created_at: r.createdAt, reporter: { id: r.reporter.id, username: r.reporter.username, email: r.reporter.email } }));
  return ok(res, { reports: items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null });
}));

app.put('/api/v1/reports/:id', withAdmin(async (req: AuthRequest, res) => {
  const id = paramId(req, 'id');
  const { status } = req.body as { status: string };
  if (!['resolved', 'dismissed'].includes(status)) return err(res, 400, 'Status must be "resolved" or "dismissed"');
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return err(res, 404, 'Report not found');
  const updated = await prisma.report.update({ where: { id }, data: { status }, select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true } });
  return ok(res, { id: updated.id, target_type: updated.targetType, target_id: updated.targetId, reason: updated.reason, status: updated.status, created_at: updated.createdAt });
}));

// ─── Health ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => ok(res, { status: 'ok' }));
app.get('/api/v1/health', (_req, res) => ok(res, { status: 'ok' }));

// ─── Error handler ───────────────────────────────────────────────
app.use((e: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(e);
  res.status(500).json({ detail: 'Internal server error' });
});

// ─── Local dev server ────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3001', 10);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
