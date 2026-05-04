import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "../config/redis";

/** Login rate limiter: 5 attempts / 15 min per IP. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "TooManyRequests", message: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new RedisStore({
    // ioredis sendCommand wrapper expected by rate-limit-redis
    sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<unknown>
  })
});

/** Generic API limiter applied app-wide. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<unknown>
  })
});
