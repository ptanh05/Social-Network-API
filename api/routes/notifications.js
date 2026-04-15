import { prisma } from '../types/index.js';
import { ok, noContent } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { Router } from 'express';
const router = Router();
function safeCursor(req) { return typeof req.query.cursor === 'string' ? req.query.cursor : undefined; }
function safeLimit(req) { return Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50); }
router.get('/', withAuth(async (req, res) => {
    const u = getUser(req);
    const cursor = safeCursor(req);
    const limit = safeLimit(req);
    const notifications = await prisma.notification.findMany({
        where: { userId: u.id, ...(cursor ? { id: { lt: parseInt(cursor, 10) } } : {}) },
        orderBy: { id: 'desc' }, take: limit + 1,
    });
    const hasMore = notifications.length > limit;
    const items = notifications.slice(0, limit);
    return ok(res, { notifications: items.map((n) => ({ id: n.id, user_id: n.userId, type: n.type, data: n.data, actor_avatar_url: n.actorAvatarUrl, is_read: n.isRead, created_at: n.createdAt })), next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null });
}));
router.get('/unread-count', withAuth(async (req, res) => {
    const u = getUser(req);
    const count = await prisma.notification.count({ where: { userId: u.id, isRead: false } });
    return ok(res, { count });
}));
router.put('/:id/read', withAuth(async (req, res) => {
    const u = getUser(req);
    await prisma.notification.updateMany({ where: { id: paramId(req, 'id'), userId: u.id }, data: { isRead: true } });
    return noContent(res);
}));
router.put('/read-all', withAuth(async (req, res) => {
    const u = getUser(req);
    await prisma.notification.updateMany({ where: { userId: u.id }, data: { isRead: true } });
    return noContent(res);
}));
export default router;
