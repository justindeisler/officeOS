import { ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      result.error.errors.forEach(e => {
        fields[e.path.join('.')] = e.message;
      });
      return next(new ValidationError('Validation failed', fields));
    }
    req.body = result.data; // replace with parsed/coerced data
    next();
  };
}
