import { ok } from '../lib/utils.js';
import { Router } from 'express';
const router = Router();
router.get('/', (_req, res) => ok(res, { status: 'ok' }));
export default router;
