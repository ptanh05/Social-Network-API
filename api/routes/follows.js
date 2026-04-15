import { prisma } from '../types/index.js';
import { ok, created, err } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { Router } from 'express';
const router = Router();
function safeCursor(req) { return typeof req.query.cursor === 'string' ? req.query.cursor : undefined; }
function safeLimit(req) { return Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50); }
router.get('/users/:id/followers', withAuth(async (req, res) => {
    const userId = paramId(req, 'id');
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const whereCond = { followingId: userId };
    if (cursor)
        whereCond.createdAt = { lt: new Date(cursor) };
    const follows = await prisma.follow.findMany({
        where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1,
        include: { follower: { select: { id: true, username: true, email: true, createdAt: true } } },
    });
    const hasMore = follows.length > limit;
    const items = follows.slice(0, limit).map((f) => ({ id: f.follower.id, username: f.follower.username, email: f.follower.email, created_at: f.follower.createdAt }));
    return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(follows[follows.length - 1]?.createdAt) : null });
}));
router.get('/users/:id/following', withAuth(async (req, res) => {
    const userId = paramId(req, 'id');
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const whereCond = { followerId: userId };
    if (cursor)
        whereCond.createdAt = { lt: new Date(cursor) };
    const follows = await prisma.follow.findMany({
        where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1,
        include: { following: { select: { id: true, username: true, email: true, createdAt: true } } },
    });
    const hasMore = follows.length > limit;
    const items = follows.slice(0, limit).map((f) => ({ id: f.following.id, username: f.following.username, email: f.following.email, created_at: f.following.createdAt }));
    return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(follows[follows.length - 1]?.createdAt) : null });
}));
router.get('/users/:id/status', withAuth(async (req, res) => {
    const u = getUser(req);
    const follow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: u.id, followingId: paramId(req, 'id') } } });
    return ok(res, { following: !!follow });
}));
router.post('/users/:id/follow', withAuth(async (req, res) => {
    const me = getUser(req);
    const targetId = paramId(req, 'id');
    if (me.id === targetId)
        return err(res, 400, 'Cannot follow yourself');
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target)
        return err(res, 404, 'User not found');
    try {
        await prisma.follow.create({ data: { followerId: me.id, followingId: targetId } });
        await prisma.notification.create({ data: { userId: targetId, type: 'follow', data: { actor_id: me.id, actor_username: me.username }, actorAvatarUrl: me.avatar_url || null } });
        return created(res, { following: true });
    }
    catch (e) {
        if (e.code === 'P2002')
            return err(res, 400, 'Already following');
        throw e;
    }
}));
router.delete('/users/:id/follow', withAuth(async (req, res) => {
    const u = getUser(req);
    const result = await prisma.follow.deleteMany({ where: { followerId: u.id, followingId: paramId(req, 'id') } });
    if (!result.count)
        return err(res, 404, 'Not following');
    return ok(res, { following: false });
}));
export default router;
