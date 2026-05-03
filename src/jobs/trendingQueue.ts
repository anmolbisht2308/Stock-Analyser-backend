import { Queue, Worker, type Job } from "bullmq";
import { getRedis } from "../lib/redis";
import { yf } from "../services/yahooFinance";
import { TrendingSnapshotModel } from "../models/TrendingSnapshot.model";
import { logger } from "../lib/logger";

const QUEUE_NAME = "trending";
const MARKET = "IN";
const REDIS_KEY = `trending:${MARKET}`;
const REDIS_TTL_SECONDS = 75 * 60; // 75 minutes
const JOB_ID = "hourly-trending";
const REPEAT_EVERY_MS = 60 * 60 * 1000; // 1 hour

export type TrendingTicker = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
};

async function fetchTrendingTickers(): Promise<TrendingTicker[]> {
  let symbols: string[] = [];
  try {
    // Get top 20 trending symbols for India
    const trending = await yf.trendingSymbols(MARKET, { count: 20 });
    symbols = (trending as any).quotes.map((q: any) => q.symbol).filter(Boolean);
  } catch (err) {
    logger.warn(`Yahoo trending API failed for ${MARKET}, using fallback tickers`, { err });
    // Yahoo's trending endpoint for IN breaks frequently. Fallback to top Nifty50.
    symbols = [
      "RELIANCE.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS", "TCS.NS", 
      "ITC.NS", "LART.NS", "SBIN.NS", "BHARTIARTL.NS", "BAJFINANCE.NS"
    ];
  }

  if (symbols.length === 0) return [];

  // Batch fetch quotes for all symbols
  const quotes = await Promise.allSettled(symbols.map((sym) => yf.quote(sym)));

  const tickers: TrendingTicker[] = [];
  for (const result of quotes) {
    if (result.status === "fulfilled") {
      const q = (result as any).value as any;
      tickers.push({
        symbol: q.symbol ?? "",
        name: q.longName || q.shortName || q.symbol || "",
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
        marketCap: q.marketCap ?? 0,
      });
    }
  }

  return tickers;
}

async function processTrendingJob(_job: Job): Promise<void> {
  logger.info("Trending job: starting fetch", { market: MARKET });

  const tickers = await fetchTrendingTickers();
  if (tickers.length === 0) {
    logger.warn("Trending job: no tickers returned");
    return;
  }

  const fetchedAt = new Date();

  // Write to MongoDB
  await TrendingSnapshotModel.create({ market: MARKET, fetchedAt, tickers });

  // Prune old snapshots — keep only last 48
  const all = await TrendingSnapshotModel.find({ market: MARKET }, { _id: 1 }, { sort: { fetchedAt: -1 } }).lean();
  if (all.length > 48) {
    const toDelete = all.slice(48).map((d) => d._id);
    await TrendingSnapshotModel.deleteMany({ _id: { $in: toDelete } });
  }

  // Cache in Redis
  const redis = getRedis();
  await redis.set(REDIS_KEY, JSON.stringify({ market: MARKET, fetchedAt, tickers }), "EX", REDIS_TTL_SECONDS);

  logger.info("Trending job: done", { market: MARKET, count: tickers.length });
}

let _queue: Queue | null = null;
let _worker: Worker | null = null;

export function startTrendingWorker(): void {
  const connection = getRedis();

  _queue = new Queue(QUEUE_NAME, { connection });
  _worker = new Worker(QUEUE_NAME, processTrendingJob, { connection });

  _worker.on("completed", (job) => logger.info("Trending job completed", { id: job.id }));
  _worker.on("failed", (job, err) => logger.error("Trending job failed", { id: job?.id, err }));

  // Schedule the repeatable hourly job
  _queue
    .add(JOB_ID, {}, { repeat: { every: REPEAT_EVERY_MS }, jobId: JOB_ID })
    .then(() => logger.info("Trending repeatable job scheduled", { every: `${REPEAT_EVERY_MS / 60000} min` }))
    .catch((err) => logger.error("Failed to schedule trending job", { err }));

  // Trigger an immediate first run
  _queue
    .add(`${JOB_ID}-immediate`, {}, { jobId: `${JOB_ID}-immediate-${Date.now()}` })
    .then(() => logger.info("Trending immediate job enqueued"))
    .catch((err) => logger.error("Failed to enqueue immediate trending job", { err }));
}

export function getTrendingQueue(): Queue {
  if (!_queue) throw new Error("Trending queue not initialized");
  return _queue;
}
