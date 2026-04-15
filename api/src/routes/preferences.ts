import { Response } from 'express';
import { prisma, AuthRequest } from '../types/index.js';
import { ok } from '../lib/utils.js';
import { withAuth, getUser } from '../middleware/auth.js';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const updatePrefsSchema = z.object({ topic_ids: z.array(z.number()) });

router.get('/users/me/preferences', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const pref = await prisma.userPreference.findUnique({ where: { userId: u.id } });
  const topicIds = pref?.topicIds || [];
  const topics = await prisma.topic.findMany({ where: { id: { in: topicIds } } });
  return ok(res, { topics: topics.map((t) => ({ id: t.id, name: t.name, description: t.description })) });
}));

router.put('/users/me/preferences', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const { topic_ids } = req.body as { topic_ids: number[] };
  const existing = await prisma.userPreference.findUnique({ where: { userId: u.id } });
  if (existing) {
    await prisma.userPreference.update({ where: { userId: u.id }, data: { topicIds: topic_ids } });
  } else {
    await prisma.userPreference.create({ data: { userId: u.id, topicIds: topic_ids } });
  }
  const topics = await prisma.topic.findMany({ where: { id: { in: topic_ids } } });
  return ok(res, { topics: topics.map((t) => ({ id: t.id, name: t.name, description: t.description })) });
}));

export default router;