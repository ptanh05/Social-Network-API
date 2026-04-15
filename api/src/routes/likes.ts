import { Response } from 'express';
import { prisma, AuthRequest } from '../types/index.js';
import { ok, created, err } from '../lib/utils.js';
import { withAuth, paramId, getUser } from '../middleware/auth.js';
import { Router } from 'express';

const router = Router();

router.post('/posts/:id/like', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) return err(res, 404, 'Post not found');
  try {
    await prisma.like.create({ data: { userId: u.id, postId } });
    await prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
    if (post.authorId !== u.id) {
      await prisma.notification.create({ data: { userId: post.authorId, type: 'like', data: { actor_id: u.id, actor_username: u.username, post_id: postId }, actorAvatarUrl: u.avatar_url || null } });
    }
    return created(res, { liked: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return err(res, 400, 'Already liked');
    throw e;
  }
}));

router.delete('/posts/:id/like', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const postId = paramId(req, 'id');
  const result = await prisma.like.deleteMany({ where: { userId: u.id, postId } });
  if (!result.count) return err(res, 404, 'Like not found');
  await prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
  return ok(res, { liked: false });
}));

router.get('/posts/:id/status', withAuth(async (req: AuthRequest, res: Response) => {
  const u = getUser(req);
  const like = await prisma.like.findUnique({ where: { userId_postId: { userId: u.id, postId: paramId(req, 'id') } } });
  return ok(res, { liked: !!like });
}));

export default router;