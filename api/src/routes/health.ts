import { Request, Response } from 'express';
import { ok } from '../lib/utils.js';
import { Router } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => ok(res, { status: 'ok' }));

export default router;
