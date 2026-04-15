import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { err } from '../lib/utils.js';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zerr = result.error as ZodError;
      const messages = zerr.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return err(res, 400, messages);
    }
    req.body = result.data;
    next();
  };
}
