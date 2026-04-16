import express from 'express';
import crypto from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const { PrismaClient } = prismaClientPkg;
const SALT_ROUNDS = 10;
const SECRET = process.env.SECRET_KEY || 'fallback-secret';
const ALGORITHM = process.env.ALGORITHM || 'HS256';
const EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10', 10);

interface TokenPayload {
  sub: number;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  avatar_url: string;
}

type AuthRequest = express.Request & { user?: AuthUser };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & { prisma?: InstanceType<typeof PrismaClient> };
const prisma: InstanceType<typeof PrismaClient> = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

function signAccessToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'access' }, SECRET, {
    algorithm: ALGORITHM as jwt.Algorithm,
    expiresIn: `${EXPIRE_MINUTES}m`,
  });
}

function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, SECRET, {
    algorithm: ALGORITHM as jwt.Algorithm,
    expiresIn: '7d',
  });
}

function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET, { algorithms: [ALGORITHM as jwt.Algorithm] }) as unknown as TokenPayload;
  } catch {
    return null;
  }
}

function ok(res: express.Response, data: unknown): void {
  res.json(data);
}

function created(res: express.Response, data: unknown): void {
  res.status(201).json(data);
}

function noContent(res: express.Response): void {
  res.sendStatus(204);
}

function err(res: express.Response, status: number, msg: string): void {
  res.status(status).json({ detail: msg });
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendVerificationEmail(to: string, username: string, verifyUrl: string): Promise<void> {
  const transporter = buildTransporter();
  if (!transporter) throw new Error('SMTP is not configured');

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@socialnet.local';
  await transporter.sendMail({
    from,
    to,
    subject: 'Xac thuc tai khoan SocialNet',
    text: `Xin chao ${username},\n\nVui long bam vao link sau de xac thuc tai khoan:\n${verifyUrl}\n\nLink co hieu luc trong 24 gio.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Xin chao ${username},</h2>
        <p>Cam on ban da dang ky SocialNet.</p>
        <p>Vui long bam vao nut ben duoi de xac thuc email:</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
            Xac thuc tai khoan
          </a>
        </p>
        <p>Hoac copy link sau vao trinh duyet:</p>
        <p>${verifyUrl}</p>
        <p>Link co hieu luc trong 24 gio.</p>
      </div>
    `,
  });
}

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  // Vercel frontend URLs
  'https://frontend-delta-bice-22.vercel.app',
  'https://frontend-jds2yl23u-ptanh05s-projects.vercel.app',
  'https://frontend-2pmqjxpmt-ptanh05s-projects.vercel.app',
  'https://social-network-mzdhoa71p-ptanh05s-projects.vercel.app',
  'https://social-network-5emiiq1c9-ptanh05s-projects.vercel.app',
  'https://social-network-api-seven.vercel.app',
  'https://social-network-g68stlz7u-ptanh05s-projects.vercel.app',
  'https://social-network-9txoa9a5w-ptanh05s-projects.vercel.app',
  'https://social-network-lz1cvcubn-ptanh05s-projects.vercel.app',
  'https://social-network-xdydrfgcu-ptanh05s-projects.vercel.app',
  'https://social-network-7uvvrrubn-ptanh05s-projects.vercel.app',
  'https://social-net-eight.vercel.app',
  // Render backend + other domains
  'https://social-network-api-f1kb.onrender.com',
  'https://api-roan-rho-71.vercel.app',
  'https://social-network-aplqf0k.onrender.com',
];

const app = express();
const REFRESH_COOKIE_NAME = 'refresh_token';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
const API_PUBLIC_BASE_URL = process.env.API_PUBLIC_BASE_URL || 'http://localhost:3001/api/v1';

// CORS middleware — handles OPTIONS preflight and sets headers for all allowed origins
app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  res.setHeader('Vary', 'Origin');
  // Always set method + headers headers on OPTIONS
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  // Only set credential headers + origin for allowlisted domains
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

// ─── Helpers ─────────────────────────────────────────────────────
function paramId(req: express.Request, name: string): number {
  const val = req.params[name];
  return parseInt(Array.isArray(val) ? val[0] : val as string, 10);
}
function getUser(req: AuthRequest): AuthUser { return req.user!; }

function withAuth(handler: (req: AuthRequest, res: express.Response) => Promise<unknown>) {
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

function validate(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return err(res, 400, parsed.error.issues[0].message);
    next();
  };
}

function hashRawToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name || rest.length === 0) return acc;
    acc[name] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function setRefreshCookie(res: express.Response, refreshToken: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearRefreshCookie(res: express.Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

async function issueAuthTokens(res: express.Response, userId: number): Promise<{ access_token: string; expires_in: number }> {
  const access_token = signAccessToken(userId);
  const refresh_token = signRefreshToken(userId);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: await hashPassword(refresh_token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  setRefreshCookie(res, refresh_token);
  return { access_token, expires_in: 600 };
}

// ─── Schemas ──────────────────────────────────────────────────────
const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{4,20}$/, 'Username từ 4-20 ký tự, chỉ gồm chữ cái, số và dấu gạch dưới').min(4, 'Username từ 4-20 ký tự').max(20),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  date_of_birth: z.string().optional(),
});

const registerValidation = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    return err(res, 400, msg);
  }
  next();
};

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
const refreshSchema = z.object({ refresh_token: z.string().min(1).optional() });
const createPostSchema = z.object({ content: z.string().min(1).max(5000), topic_ids: z.array(z.number()).optional() });
const updatePostSchema = z.object({ content: z.string().min(1).max(5000).optional(), topic_ids: z.array(z.number()).optional() });
const createCommentSchema = z.object({ content: z.string().min(1).max(1000), parent_id: z.number().optional() });
const createReportSchema = z.object({ target_type: z.enum(['post', 'comment', 'user']), target_id: z.number().int().positive(), reason: z.string().min(5).max(1000) });

// ─── Auth ────────────────────────────────────────────────────────
app.post('/api/v1/auth/register', registerValidation, async (req, res) => {
  const body = req.body as { username: string; email: string; password: string; date_of_birth?: string };

  // Check duplicate email before creating
  const existingEmail = await prisma.user.findUnique({ where: { email: body.email } });
  if (existingEmail) return err(res, 400, 'Email này đã được đăng ký. Vui lòng dùng email khác.');

  // Check duplicate username
  const existingUsername = await prisma.user.findUnique({ where: { username: body.username } });
  if (existingUsername) return err(res, 400, 'Username này đã tồn tại. Vui lòng chọn username khác.');

  try {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = hashRawToken(verificationToken);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        hashedPassword: await hashPassword(body.password),
        dateOfBirth: body.date_of_birth ? new Date(body.date_of_birth) : null,
        emailVerificationTokenHash: verificationTokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: { id: true, username: true, email: true, dateOfBirth: true, isAdmin: true, createdAt: true },
    });
    const verifyUrl = `${API_PUBLIC_BASE_URL}/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(user.email, user.username, verifyUrl);
    return created(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      date_of_birth: user.dateOfBirth,
      is_admin: user.isAdmin,
      created_at: user.createdAt,
      detail: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
    });
  } catch (e: unknown) {
    const e2 = e as { code?: string; meta?: { target?: string[] } };
    if (e2.code === 'P2002') return err(res, 400, 'Username hoặc Email đã tồn tại.');
    return err(res, 500, 'Đăng ký thất bại. Vui lòng thử lại.');
  }
});

app.get('/api/v1/auth/verify-email', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.redirect(`${FRONTEND_BASE_URL}/login?verified=missing`);

  const tokenHash = hashRawToken(token);
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) return res.redirect(`${FRONTEND_BASE_URL}/login?verified=invalid`);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });
  return res.redirect(`${FRONTEND_BASE_URL}/login?verified=success`);
});

app.post('/api/v1/auth/login', validate(loginSchema), async (req, res) => {
  const body = req.body as { username: string; password: string };
  const user = await prisma.user.findUnique({ where: { username: body.username } });
  if (!user) return err(res, 401, 'Incorrect username or password');
  if (!await verifyPassword(body.password, user.hashedPassword)) return err(res, 401, 'Incorrect username or password');
  if (!user.isEmailVerified) return err(res, 403, 'Vui lòng xác thực email trước khi đăng nhập');
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  const { access_token, expires_in } = await issueAuthTokens(res, user.id);
  return ok(res, { access_token, token_type: 'bearer', expires_in });
});

app.post('/api/v1/auth/refresh', validate(refreshSchema), async (req, res) => {
  const bodyToken = (req.body as { refresh_token?: string }).refresh_token;
  const cookieToken = parseCookies(req.headers.cookie)[REFRESH_COOKIE_NAME];
  const refresh_token = bodyToken || cookieToken || '';
  if (!refresh_token) {
    clearRefreshCookie(res);
    return err(res, 401, 'Invalid refresh token');
  }

  const payload = verifyToken(refresh_token);
  if (!payload || payload.type !== 'refresh') {
    clearRefreshCookie(res);
    return err(res, 401, 'Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user) return err(res, 401, 'User not found');
  if (!user.isEmailVerified) {
    clearRefreshCookie(res);
    return err(res, 403, 'Vui lòng xác thực email trước khi đăng nhập');
  }

  const tokenRows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
  let valid = false;
  for (const tokenRow of tokenRows) {
    if (await verifyPassword(refresh_token, tokenRow.tokenHash)) {
      valid = true;
      break;
    }
  }
  if (!valid) {
    clearRefreshCookie(res);
    return err(res, 401, 'Invalid refresh token');
  }

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  const { access_token, expires_in } = await issueAuthTokens(res, user.id);
  return ok(res, { access_token, token_type: 'bearer', expires_in });
});

app.post('/api/v1/auth/logout', async (req, res) => {
  const cookieToken = parseCookies(req.headers.cookie)[REFRESH_COOKIE_NAME];
  if (cookieToken) {
    const cookiePayload = verifyToken(cookieToken);
    if (cookiePayload && cookiePayload.type === 'refresh') {
      await prisma.refreshToken.deleteMany({ where: { userId: Number(cookiePayload.sub) } });
    }
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload && payload.type === 'access') await prisma.refreshToken.deleteMany({ where: { userId: Number(payload.sub) } });
  }
  clearRefreshCookie(res);
  return ok(res, { success: true });
});

// ─── Users ──────────────────────────────────────────────────────
app.get('/api/v1/users/me', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const fullUser = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } });
  return ok(res, { id: fullUser!.id, username: fullUser!.username, email: fullUser!.email, avatar_url: fullUser!.avatarUrl, date_of_birth: fullUser!.dateOfBirth, is_admin: fullUser!.isAdmin, created_at: fullUser!.createdAt });
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
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true, followersCount: true, followingCount: true, postsCount: true }
  });
  if (!user) return err(res, 404, 'User not found');
  return ok(res, {
    id: user.id, username: user.username, email: user.email,
    avatar_url: user.avatarUrl, date_of_birth: user.dateOfBirth,
    is_admin: user.isAdmin, created_at: user.createdAt,
    followers_count: user.followersCount,
    following_count: user.followingCount,
    posts_count: user.postsCount,
  });
}));

app.get('/api/v1/users/:id/posts', withAuth(async (req, res) => {
  const userId = paramId(req, 'id');
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: { authorId: number; createdAt?: { lt: Date } } = { authorId: userId };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const posts = await prisma.post.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => ({
    id: p.id, content: p.content, author_id: p.authorId, created_at: p.createdAt, updated_at: p.updatedAt, likes_count: p.likesCount, comments_count: p.commentsCount,
    topics: p.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
    author: { id: p.author.id, username: p.author.username, email: p.author.email, avatar_url: p.author.avatarUrl, date_of_birth: p.author.dateOfBirth, is_admin: p.author.isAdmin, created_at: p.author.createdAt },
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

function buildPostResponse(p: { id: number; content: string; authorId: number; createdAt: Date; updatedAt: Date; likesCount: number; commentsCount: number; author: { id: number; username: string; email: string; avatarUrl?: string; dateOfBirth: unknown; isAdmin: boolean; createdAt: Date }; topics: Array<{ topic: { id: number; name: string; description: unknown } }> }, feed_score = 0) {
  return { id: p.id, content: p.content, author_id: p.authorId, created_at: p.createdAt, updated_at: p.updatedAt, likes_count: p.likesCount, comments_count: p.commentsCount, topics: p.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })), author: { id: p.author.id, username: p.author.username, email: p.author.email, avatar_url: p.author.avatarUrl, date_of_birth: p.author.dateOfBirth, is_admin: p.author.isAdmin, created_at: p.author.createdAt }, feed_score };
}

app.get('/api/v1/posts/feed', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const [prefs, following] = await Promise.all([prisma.userPreference.findUnique({ where: { userId: u.id } }), prisma.follow.findMany({ where: { followerId: u.id }, select: { followingId: true } })]);
  const preferredTopicIds = prefs?.topicIds || [];
  const followingIds = following.map((f) => f.followingId);
  const posts = await prisma.post.findMany({ where: cursor ? { createdAt: { lt: new Date(cursor) } } : {}, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
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
  const posts = await prisma.post.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
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
  const posts = await prisma.post.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map((p) => buildPostResponse(p));
  return ok(res, { items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null });
}));

app.post('/api/v1/posts', validate(createPostSchema), withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const { content, topic_ids } = req.body as { content: string; topic_ids?: number[] };
  const post = await prisma.post.create({ data: { content, authorId: u.id }, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  await prisma.user.update({ where: { id: u.id }, data: { postsCount: { increment: 1 } } });
  if (topic_ids?.length) await prisma.postTopic.createMany({ data: topic_ids.map((tid) => ({ postId: post.id, topicId: tid })), skipDuplicates: true });
  const hashtags = extractHashtags(content);
  await Promise.all(hashtags.map((name) => prisma.hashtag.upsert({ where: { name }, create: { name, postCount: 1 }, update: { postCount: { increment: 1 } } })));
  const refreshed = await prisma.post.findUnique({ where: { id: post.id }, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  return created(res, buildPostResponse(refreshed!));
}));

app.get('/api/v1/posts/:id', withAuth(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: paramId(req, 'id') }, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
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
  const refreshed = await prisma.post.findUnique({ where: { id: postId }, include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } });
  return ok(res, buildPostResponse(refreshed!));
}));

app.delete('/api/v1/posts/:id', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) return err(res, 404, 'Post not found');
  if (existing.authorId !== u.id) return err(res, 403, 'Not authorized');
  await prisma.post.delete({ where: { id: postId } });
  await prisma.user.update({ where: { id: existing.authorId }, data: { postsCount: { decrement: 1 } } });
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
  if (post.authorId !== u.id) {
    const notif = await prisma.notification.create({ data: { userId: post.authorId, type: 'comment', data: { actor_id: u.id, actor_username: u.username, post_id: postId }, actorAvatarUrl: u.avatar_url || null } });
    broadcastNotification(post.authorId, { ...notif, actor_avatar_url: u.avatar_url });
  }
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
    if (post.authorId !== u.id) {
      const notif = await prisma.notification.create({ data: { userId: post.authorId, type: 'like', data: { actor_id: u.id, actor_username: u.username, post_id: postId }, actorAvatarUrl: u.avatar_url || null } });
      broadcastNotification(post.authorId, { ...notif, actor_avatar_url: u.avatar_url });
    }
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
    await Promise.all([
      prisma.user.update({ where: { id: me.id }, data: { followingCount: { increment: 1 } } }),
      prisma.user.update({ where: { id: targetId }, data: { followersCount: { increment: 1 } } }),
    ]);
    const notif = await prisma.notification.create({ data: { userId: targetId, type: 'follow', data: { actor_id: me.id, actor_username: me.username }, actorAvatarUrl: me.avatar_url || null } });
    broadcastNotification(targetId, { ...notif, actor_avatar_url: me.avatar_url });
    return created(res, { following: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return err(res, 400, 'Already following');
    throw e;
  }
}));

app.delete('/api/v1/follows/users/:id/follow', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const targetId = paramId(req, 'id');
  const result = await prisma.follow.deleteMany({ where: { followerId: u.id, followingId: targetId } });
  if (!result.count) return err(res, 404, 'Not following');
  await Promise.all([
    prisma.user.update({ where: { id: u.id }, data: { followingCount: { decrement: 1 } } }),
    prisma.user.update({ where: { id: targetId }, data: { followersCount: { decrement: 1 } } }),
  ]);
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

// ─── Notifications Stream (SSE) ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notificationStreams = new Map<number, Set<(eventName: string, data: any) => void>>();

export function broadcastNotification(userId: number, notification: unknown) {
  const handlers = notificationStreams.get(userId);
  if (handlers) {
    for (const sendEvent of handlers) {
      try {
        sendEvent('notification', { notification });
      } catch {
        // Client disconnected — will be cleaned up by req 'close' event
      }
    }
  }
}

app.get('/api/v1/notifications/stream', async (req: express.Request, res: express.Response) => {
  // EventSource cannot send custom Authorization headers — accept token via query param
  const rawToken = (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : (typeof req.query.access_token === 'string' ? req.query.access_token : '');

  if (!rawToken) {
    res.status(401).json({ detail: 'Missing token' });
    return;
  }

  const payload = verifyToken(rawToken);
  if (!payload || payload.type !== 'access') {
    res.status(401).json({ detail: 'Invalid or expired token' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, username: true, email: true, isAdmin: true, avatarUrl: true },
  });
  if (!user) {
    res.status(401).json({ detail: 'User not found' });
    return;
  }

  const authUser: AuthUser = {
    id: user.id, username: user.username, email: user.email,
    is_admin: user.isAdmin, avatar_url: user.avatarUrl,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!notificationStreams.has(authUser.id)) {
    notificationStreams.set(authUser.id, new Set());
  }
  notificationStreams.get(authUser.id)!.add(sendEvent);

  sendEvent('connected', { userId: authUser.id });

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationStreams.get(authUser.id)?.delete(sendEvent);
    if (notificationStreams.get(authUser.id)?.size === 0) {
      notificationStreams.delete(authUser.id);
    }
  });
});

// ─── Bookmarks ───────────────────────────────────────────────────
app.get('/api/v1/bookmarks', withAuth(async (req: AuthRequest, res) => {
  const u = getUser(req);
  const cursor = safeCursor(req);
  const limit = safeLimit(req);
  const whereCond: Record<string, unknown> = { userId: u.id };
  if (cursor) whereCond.createdAt = { lt: new Date(cursor) };
  const bookmarks = await prisma.bookmark.findMany({ where: whereCond, orderBy: { createdAt: 'desc' }, take: limit + 1, include: { post: { include: { author: { select: { id: true, username: true, email: true, avatarUrl: true, dateOfBirth: true, isAdmin: true, createdAt: true } }, topics: { include: { topic: true } } } } } });
  const hasMore = bookmarks.length > limit;
  const posts = bookmarks.slice(0, limit).map((b) => ({
    id: b.post.id, content: b.post.content, author_id: b.post.authorId, created_at: b.post.createdAt, updated_at: b.post.updatedAt, likes_count: b.post.likesCount, comments_count: b.post.commentsCount,
    topics: b.post.topics.map((pt) => ({ id: pt.topic.id, name: pt.topic.name, description: pt.topic.description })),
    author: { id: b.post.author.id, username: b.post.author.username, email: b.post.author.email, avatar_url: b.post.author.avatarUrl, date_of_birth: b.post.author.dateOfBirth, is_admin: b.post.author.isAdmin, created_at: b.post.author.createdAt },
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

  // Fetch content preview for each report
  const enrichedReports = await Promise.all(reports.map(async (r) => {
    let content: string | null = null;
    if (r.targetType === 'post') {
      const post = await prisma.post.findUnique({ where: { id: r.targetId }, select: { content: true } });
      content = post?.content ?? null;
    } else if (r.targetType === 'comment') {
      const comment = await prisma.comment.findUnique({ where: { id: r.targetId }, select: { content: true } });
      content = comment?.content ?? null;
    } else if (r.targetType === 'user') {
      const target = await prisma.user.findUnique({ where: { id: r.targetId }, select: { username: true } });
      content = target?.username ?? null;
    }
    return {
      id: r.id, target_type: r.targetType, target_id: r.targetId, reason: r.reason,
      status: r.status, created_at: r.createdAt,
      reporter: { id: r.reporter.id, username: r.reporter.username, email: r.reporter.email },
      content,
    };
  }));

  const hasMore = enrichedReports.length > limit;
  const items = enrichedReports.slice(0, limit);
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
