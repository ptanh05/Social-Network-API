import { Response } from 'express';

export function ok(res: Response, data: unknown): void {
  res.json(data);
}

export function created(res: Response, data: unknown): void {
  res.status(201).json(data);
}

export function noContent(res: Response): void {
  res.sendStatus(204);
}

export function err(res: Response, status: number, msg: string): void {
  res.status(status).json({ detail: msg });
}

export function rateLimitResponse(res: Response, retryAfter: number): void {
  res.status(429)
    .set('Retry-After', String(retryAfter))
    .json({ detail: 'Too many requests. Please try again later.' });
}
