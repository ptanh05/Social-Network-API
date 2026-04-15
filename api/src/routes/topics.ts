import { Response } from 'express';
import { prisma, AuthRequest } from '../types/index.js';
import { ok } from '../lib/utils.js';
import { withAuth } from '../middleware/auth.js';
import { Router } from 'express';

const router = Router();

router.get('/', withAuth(async (_req: AuthRequest, res: Response) => {
  const topics = await prisma.topic.findMany({ orderBy: { id: 'asc' } });
  return ok(res, topics.map((t) => ({ id: t.id, name: t.name, description: t.description })));
}));

export default router;
