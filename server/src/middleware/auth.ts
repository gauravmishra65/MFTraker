import { NextFunction, Request, Response } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { Unauthorized } from "../utils/errors";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(Unauthorized("Missing bearer token"));
  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(Unauthorized("Invalid or expired token"));
  }
}
