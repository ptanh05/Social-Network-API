import { Request, Response } from 'express';
import { prisma } from '../types/index.js';
import { ok, created, err } from '../lib/utils.js';
import { validate } from '../middleware/validate.js';
import { withLoginLimit } from '../middleware/rateLimit.js';
import { hashPassword, verifyPassword } from '../lib/bcrypt.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{4,20}$/).min(4).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  date_of_birth: z.string().optional(),
});

const refreshSchema = z.object({ refresh_token: z.string().min(1) });

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const body = req.body as { username: string; email: string; password: string; date_of_birth?: string };
  try {
    const hashed = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { username: body.username, email: body.email, hashedPassword: hashed, dateOfBirth: body.date_of_birth ? new Date(body.date_of_birth) : null },
      select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true },
    });
    return created(res, { id: user.id, username: user.username, email: user.email, date_of_birth: user.dateOfBirth, is_admin: user.isAdmin, created_at: user.createdAt });
  } catch (e: unknown) {
    const err2 = e as { code?: string; meta?: { target?: string[] } };
    if (err2.code === 'P2002') {
      const field = err2.meta?.target?.[0]?.includes('username') ? 'Username' : 'Email';
      return err(res, 400, `${field} already registered`);
    }
    return err(res, 500, 'Registration failed');
  }
});

router.post('/login', withLoginLimit(async (req: Request, res: Response) => {
  const body = req.body as { username: string; password: string };
  const user = await prisma.user.findUnique({ where: { username: body.username } });
  if (!user) return err(res, 401, 'Incorrect username or password');
  const valid = await verifyPassword(body.password, user.hashedPassword);
  if (!valid) return err(res, 401, 'Incorrect username or password');
  const access_token = signAccessToken(user.id);
  const refresh_token = signRefreshToken(user.id);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: await hashPassword(refresh_token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  return ok(res, { access_token, refresh_token, token_type: 'bearer', expires_in: 600 });
}));

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
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

router.post('/logout', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const payload = verifyToken(token);
    if (payload && payload.type === 'access') {
      await prisma.refreshToken.deleteMany({ where: { userId: Number(payload.sub) } });
    }
  }
  return ok(res, { success: true });
});

export default router;
