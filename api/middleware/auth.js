import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../types/index.js';
import { err } from '../lib/utils.js';
// ─── Helpers ──────────────────────────────────────────────────────────────────
export function paramId(req, name) {
    const val = req.params[name];
    if (Array.isArray(val))
        return parseInt(val[0], 10);
    return parseInt(val, 10);
}
export function getUser(req) {
    return req.user;
}
export function withAuth(handler) {
    return async (req, res, _next) => {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            return err(res, 401, 'Missing or invalid authorization header');
        }
        const payload = verifyToken(auth.slice(7));
        if (!payload || payload.type !== 'access') {
            return err(res, 401, 'Invalid or expired access token');
        }
        const user = await prisma.user.findUnique({
            where: { id: Number(payload.sub) },
            select: { id: true, username: true, email: true, isAdmin: true, avatarUrl: true },
        });
        if (!user)
            return err(res, 401, 'User not found');
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.isAdmin,
            avatar_url: user.avatarUrl,
        };
        await handler(req, res);
    };
}
export function withAdmin(handler) {
    return withAuth(async (req, res) => {
        if (!req.user?.is_admin)
            return err(res, 403, 'Admin access required');
        await handler(req, res);
    });
}
