import { getRedis } from "../lib/redis";

export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSetJSON(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

