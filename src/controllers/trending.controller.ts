import { asyncHandler } from "../utils/asyncHandler";
import { getRedis } from "../lib/redis";
import { TrendingSnapshotModel } from "../models/TrendingSnapshot.model";

const MARKET = "IN";
const REDIS_KEY = `trending:${MARKET}`;

export const getTrending = asyncHandler(async (_req, res) => {
  // 1. Try Redis cache first
  const redis = getRedis();
  const cached = await redis.get(REDIS_KEY);
  if (cached) {
    return res.json({ source: "cache", ...JSON.parse(cached) });
  }

  // 2. Fallback to latest MongoDB snapshot
  const snapshot = await TrendingSnapshotModel.findOne({ market: MARKET }).sort({ fetchedAt: -1 }).lean();
  if (snapshot) {
    return res.json({ source: "db", market: snapshot.market, fetchedAt: snapshot.fetchedAt, tickers: snapshot.tickers });
  }

  // 3. Nothing yet (worker hasn't run its first job)
  return res.json({ source: "empty", market: MARKET, fetchedAt: null, tickers: [] });
});
