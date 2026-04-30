import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { cacheGetJSON, cacheSetJSON } from "../services/cacheService";
import { fetchDailyOHLCV } from "../services/marketDataService";
import { fetchCompanyNews } from "../services/newsService";
import { fetchQuote } from "../services/quoteService";

export const getPriceHistory = asyncHandler(async (req, res) => {
  const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
  if (!ticker) throw new AppError("Ticker required", { statusCode: 400, code: "TICKER_REQUIRED" });

  // Alpha Vantage free tier is daily-only; we expose it as 1y/1d for charting.
  const cacheKey = `price-history:${ticker}`;
  const cached = await cacheGetJSON<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const bars = await fetchDailyOHLCV(ticker);
  const payload = { ticker, interval: "1d", bars };

  await cacheSetJSON(cacheKey, payload, 60);
  res.json(payload);
});

export const getNews = asyncHandler(async (req, res) => {
  const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
  if (!ticker) throw new AppError("Ticker required", { statusCode: 400, code: "TICKER_REQUIRED" });
  const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 20)));

  const cacheKey = `news:${ticker}:${limit}`;
  const cached = await cacheGetJSON<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const news = await fetchCompanyNews(ticker, limit);
  const payload = { ticker, news };
  await cacheSetJSON(cacheKey, payload, 15 * 60);
  res.json(payload);
});

export const getQuoteLive = asyncHandler(async (req, res) => {
  const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
  if (!ticker) throw new AppError("Ticker required", { statusCode: 400, code: "TICKER_REQUIRED" });

  const cacheKey = `price:${ticker}`;
  const cached = await cacheGetJSON<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const quote = await fetchQuote(ticker);
  const payload = { ticker, quote };
  await cacheSetJSON(cacheKey, payload, 60);
  res.json(payload);
});

