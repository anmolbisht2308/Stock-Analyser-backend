import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { cacheGetJSON, cacheSetJSON } from "../services/cacheService";
import { fetchDailyOHLCV } from "../services/marketDataService";
import { fetchCompanyNews } from "../services/newsService";
import { fetchAnalystRatings } from "../services/analystService";
import { fetchFundamentals } from "../services/fundamentalService";
import { fetchCompanyProfile } from "../services/profileService";
import { fetchQuote } from "../services/quoteService";
import { computeTechnicals } from "../utils/technicalIndicators";
import { analyzeStock, analysisInputSchema, type GroqAnalysisResult } from "../lib/groqAnalyzer";
import { AnalysisModel } from "../models/Analysis.model";

type AnalysisResponse = {
  ticker: string;
  cached: boolean;
  cacheTtlSeconds: number;
  raw: {
    quote: { currentPrice: number; change: number; changePercent: number };
    ohlcv: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
    news: { headline: string; source: string; publishedAt: string }[];
    analystRatings: { firm: string; rating: string; targetPrice: number }[];
    fundamentals: Record<string, unknown>;
    technicals: Record<string, unknown>;
    profile: { companyName: string; sector: string; industry: string; exchange: string };
  };
  analysis: GroqAnalysisResult;
};

const ANALYSIS_TTL_SECONDS = 30 * 60;

export const getStockAnalysis = asyncHandler(async (req, res) => {
  const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
  if (!ticker) throw new AppError("Ticker required", { statusCode: 400, code: "TICKER_REQUIRED" });

  const cacheKey = `analysis:${ticker}`;
  const cached = await cacheGetJSON<AnalysisResponse>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, cacheTtlSeconds: ANALYSIS_TTL_SECONDS });
  }

  const [profile, quote, ohlcv, fundamentals] = await Promise.all([
    fetchCompanyProfile(ticker),
    fetchQuote(ticker),
    fetchDailyOHLCV(ticker),
    fetchFundamentals(ticker),
  ]);

  // Optional (provider-plan dependent): if blocked, don't fail the entire analysis.
  const [newsRes, analystRes] = await Promise.allSettled([fetchCompanyNews(ticker, 10), fetchAnalystRatings(ticker)]);
  const news = newsRes.status === "fulfilled" ? newsRes.value : [];
  const analystRatings = analystRes.status === "fulfilled" ? analystRes.value : [];

  const technicals = computeTechnicals(ohlcv);

  const input = analysisInputSchema.parse({
    ticker,
    companyName: profile.companyName,
    currentPrice: quote.currentPrice,
    priceHistory: ohlcv.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
    technicals,
    fundamentals,
    recentNews: news.map((n) => ({ headline: n.headline, source: n.source, publishedAt: n.publishedAt })),
    analystRatings,
    sector: profile.sector,
    industry: profile.industry,
    exchange: profile.exchange,
  });

  const analysis = await analyzeStock(input);

  const response: AnalysisResponse = {
    ticker,
    cached: false,
    cacheTtlSeconds: ANALYSIS_TTL_SECONDS,
    raw: {
      quote,
      ohlcv,
      news: input.recentNews,
      analystRatings,
      fundamentals,
      technicals,
      profile,
    },
    analysis,
  };

  await Promise.all([
    cacheSetJSON(cacheKey, response, ANALYSIS_TTL_SECONDS),
    AnalysisModel.create({
      ticker,
      groqModel: "llama-3.3-70b-versatile",
      analysisVersion: "v1",
      rawInput: input,
      result: analysis,
    }),
  ]);

  res.json(response);
});

