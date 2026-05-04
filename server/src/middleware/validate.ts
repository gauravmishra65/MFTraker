import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

/** Validate `req.body` against a Zod schema and replace `req.body` with the parsed result. */
export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data as Request["body"];
    next();
  };

/** Validate query params. Replaces `req.query`. */
export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return next(parsed.error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).query = parsed.data;
    next();
  };
