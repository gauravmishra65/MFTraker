import IORedis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false
});

redis.on("error", (err) => logger.error({ err }, "Redis error"));
redis.on("connect", () => logger.info("Redis connected"));

/** Get-or-set helper with TTL in seconds. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, key }, "redis get failed, falling through");
  }
  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "redis set failed");
  }
  return value;
}
