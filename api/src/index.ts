import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import postsRouter from './routes/posts.js';
import followsRouter from './routes/follows.js';
import likesRouter from './routes/likes.js';
import topicsRouter from './routes/topics.js';
import preferencesRouter from './routes/preferences.js';
import notificationsRouter from './routes/notifications.js';
import bookmarksRouter from './routes/bookmarks.js';
import reportsRouter from './routes/reports.js';
import { prisma } from './types/index.js';
import { withAuth } from './middleware/auth.js';
import { ok } from './lib/utils.js';

const app = express();
// Strip /api prefix so /api/v1/* becomes /v1/* on Vercel rewrites
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) req.url = req.url.replace(/^\/api/, '');
  next();
});
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://social-network-api-mu.vercel.app',
  ],
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req, res) => ok(res, { status: 'ok' }));
app.get('/api/v1/health', (_req, res) => ok(res, { status: 'ok' }));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/follows', followsRouter);
app.use('/api/v1/likes', likesRouter);
app.use('/api/v1/topics', topicsRouter);
app.use('/api/v1/preferences', preferencesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/bookmarks', bookmarksRouter);
app.use('/api/v1/reports', reportsRouter);

app.get('/api/v1/users/search', withAuth(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q) return ok(res, []);
  const users = await prisma.user.findMany({
    where: { username: { contains: q, mode: 'insensitive' } },
    select: { id: true, username: true, email: true, createdAt: true },
    take: 20,
  });
  return ok(res, users);
}));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ detail: 'Internal server error' });
});

if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3001', 10);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
