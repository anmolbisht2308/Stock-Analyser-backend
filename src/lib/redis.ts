import Redis from "ioredis";
import { logger } from "./logger";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) throw new Error("Redis not initialized");
  return redis;
}

export async function connectRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Missing REDIS_URL");

  redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on("error", (err) => logger.error("Redis error", { err }));
  redis.on("connect", () => logger.info("Redis connecting"));
  redis.on("ready", () => logger.info("Redis ready"));

  await redis.connect();
}

