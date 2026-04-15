import { Request, Response, NextFunction } from 'express';
import { rateLimitResponse } from '../lib/utils.js';

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const loginLimits = new Map<string, { count: number; resetAt: number }>();

function checkLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
  windowMs: number
): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const record = store.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + windowMs; }
  record.count++;
  store.set(key, record);
  if (record.count > max) return { limited: true, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  return { limited: false, retryAfter: 0 };
}

export function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    'unknown'
  );
}

export function withRateLimit(
  handler: (req: Request, res: Response) => Promise<void>,
  options: { max?: number; windowMs?: number } = {}
) {
  const { max = 100, windowMs = 15 * 60 * 1000 } = options;
  return async (req: Request, res: Response, _next: NextFunction) => {
    const ip = getClientIp(req);
    const { limited, retryAfter } = checkLimit(rateLimits, ip, max, windowMs);
    if (limited) return rateLimitResponse(res, retryAfter);
    await handler(req, res);
  };
}

export function withLoginLimit(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const ip = getClientIp(req);
    const { limited, retryAfter } = checkLimit(loginLimits, ip, 10, 15 * 60 * 1000);
    if (limited) return rateLimitResponse(res, retryAfter);
    await handler(req, res);
  };
}
