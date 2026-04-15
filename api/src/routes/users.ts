import { Request, Response } from 'express';
import { prisma, AuthRequest } from '../types/index.js';
import { ok, err } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../lib/bcrypt.js';
import { Router } from 'express';

const router = Router();

function safeCursor(req: Request): string | undefined { return typeof req.query.cursor === 'string' ? req.query.cursor : undefined; }
function safeLimit(req: Request): number { return Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50); }

router.get('/me', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  return ok(res, { id: u.id, username: u.username, email: u.email, avatar_url: u.avatar_url, date_of_birth: null, is_admin: u.is_admin, created_at: new Date() });
}));

router.put('/me', withAuth(async (req: AuthRequest, res: Response) => {
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

router.delete('/me', withAuth(async (req: AuthRequest, res: Response) => {
  await prisma.user.delete({ where: { id: getUser(req).id } });
  return ok(res, { success: true });
}));

router.get('/:id', withAuth(async (req: AuthRequest, res: Response) => {
  const id = paramId(req, 'id');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } });
  if (!user) return err(res, 404, 'User not found');
  return ok(res, { id: user.id, username: user.username, email: user.email, avatar_url: user.avatarUrl, date_of_birth: user.dateOfBirth, is_admin: user.isAdmin, created_at: user.createdAt });
}));

router.get('/:id/profile', withAuth(async (req: AuthRequest, res: Response) => {
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

router.get('/:id/posts', withAuth(async (req: AuthRequest, res: Response) => {
  const userId = paramId(req, 'id');
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: { authorId: number; createdAt?: { lt: Date } } = { authorId: userId };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const posts = await prisma.post.findMany({
    where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1,
    include: { author: { select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } },
  });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => ({
    id: p.id, content: p.content, author_id: p.authorId, created_at: p.createdAt, updated_at: p.updatedAt, likes_count: p.likesCount, comments_count: p.commentsCount,
    topics: p.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
    author: { id: p.author.id, username: p.author.username, email: p.author.email, date_of_birth: p.author.dateOfBirth, is_admin: p.author.isAdmin, created_at: p.author.createdAt },
  }));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));

router.post('/me/change-password', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const { current_password, new_password } = req.body as { current_password: string; new_password: string };
  if (!current_password || !new_password) return err(res, 400, 'current_password and new_password are required');
  const user = await prisma.user.findUnique({ where: { id: u.id } });
  if (!user) return err(res, 401, 'User not found');
  const valid = await verifyPassword(current_password, user.hashedPassword);
  if (!valid) return err(res, 400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { hashedPassword: await hashPassword(new_password) } });
  return ok(res, { success: true });
}));

export default router;
