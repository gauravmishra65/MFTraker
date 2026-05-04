import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload, opts?: SignOptions): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    ...opts
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function signResetToken(payload: { userId: string }): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_RESET_EXPIRES_IN as SignOptions["expiresIn"]
  });
}
