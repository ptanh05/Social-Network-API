import { Response } from 'express';
import { prisma, AuthRequest } from '../types/index.js';
import { ok, created, err } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const createReportSchema = z.object({
  target_type: z.enum(['post', 'comment', 'user']),
  target_id: z.number().int().positive(),
  reason: z.string().min(5).max(1000),
});

// ─── User: report content ───────────────────────────────────────────────────
router.post('/', validate(createReportSchema), withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const { target_type, target_id, reason } = req.body as { target_type: string; target_id: number; reason: string };

  // Verify target exists
  if (target_type === 'post') {
    const post = await prisma.post.findUnique({ where: { id: target_id }, select: { id: true, authorId: true } });
    if (!post) return err(res, 404, 'Post not found');
    if (post.authorId === u.id) return err(res, 400, 'Cannot report your own post');
  } else if (target_type === 'comment') {
    const comment = await prisma.comment.findUnique({ where: { id: target_id }, select: { id: true, authorId: true } });
    if (!comment) return err(res, 404, 'Comment not found');
    if (comment.authorId === u.id) return err(res, 400, 'Cannot report your own comment');
  } else if (target_type === 'user') {
    if (target_id === u.id) return err(res, 400, 'Cannot report yourself');
    const user = await prisma.user.findUnique({ where: { id: target_id }, select: { id: true } });
    if (!user) return err(res, 404, 'User not found');
  }

  const report = await prisma.report.create({
    data: { reporterId: u.id, targetType: target_type, targetId: target_id, reason },
    select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true },
  });

  return created(res, {
    id: report.id,
    target_type: report.targetType,
    target_id: report.targetId,
    reason: report.reason,
    status: report.status,
    created_at: report.createdAt,
  });
}));

// ─── Admin: list pending reports ────────────────────────────────────────────
router.get('/', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  if (!u.is_admin) return err(res, 403, 'Admin access required');

  const cursor = typeof req.query.cursor === 'string' ? parseInt(req.query.cursor, 10) : undefined;
  const limit = Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10), 50);
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';

  const whereCond: Record<string, unknown> = { status };
  if (cursor !== undefined) whereCond.id = { lt: cursor };

  const reports = await prisma.report.findMany({
    where: whereCond, orderBy: { id: 'desc' }, take: limit + 1,
    include: {
      reporter: { select: { id: true, username: true, email: true } },
    },
  });

  const hasMore = reports.length > limit;
  const items = reports.slice(0, limit).map((r) => ({
    id: r.id, target_type: r.targetType, target_id: r.targetId, reason: r.reason,
    status: r.status, created_at: r.createdAt,
    reporter: { id: r.reporter.id, username: r.reporter.username, email: r.reporter.email },
  }));

  return ok(res, { reports: items, next_cursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null });
}));

// ─── Admin: resolve/dismiss report ─────────────────────────────────────────
router.put('/:id', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  if (!u.is_admin) return err(res, 403, 'Admin access required');

  const id = paramId(req, 'id');
  const { status } = req.body as { status: string };

  if (!['resolved', 'dismissed'].includes(status)) {
    return err(res, 400, 'Status must be "resolved" or "dismissed"');
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return err(res, 404, 'Report not found');

  const updated = await prisma.report.update({
    where: { id },
    data: { status },
    select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true },
  });

  return ok(res, {
    id: updated.id, target_type: updated.targetType, target_id: updated.targetId,
    reason: updated.reason, status: updated.status, created_at: updated.createdAt,
  });
}));

export default router;
