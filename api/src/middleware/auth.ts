import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { prisma, AuthRequest } from '../types/index.js';
import { err } from '../lib/utils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function paramId(req: Request, name: string): number {
  const val = req.params[name];
  if (Array.isArray(val)) return parseInt(val[0], 10);
  return parseInt(val as string, 10);
}

export function getUser(req: AuthRequest) {
  return req.user!;
}

export function withAuth(
  handler: (req: AuthRequest, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, _next: NextFunction) => {
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

    if (!user) return err(res, 401, 'User not found');

    (req as AuthRequest).user = {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.isAdmin,
      avatar_url: user.avatarUrl,
    };

    await handler(req as AuthRequest, res);
  };
}

export function withAdmin(
  handler: (req: AuthRequest, res: Response) => Promise<void>
) {
  return withAuth(async (req: AuthRequest, res: Response) => {
    if (!req.user?.is_admin) return err(res, 403, 'Admin access required');
    await handler(req, res);
  });
}
