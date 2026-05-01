import { asyncHandler } from "../utils/asyncHandler";
import { AnalysisModel } from "../models/Analysis.model";

const VALID_SORT_FIELDS = ["overallScore", "createdAt"] as const;
const VALID_RATINGS = ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"] as const;

export const getScreener = asyncHandler(async (req, res) => {
  const {
    minScore,
    maxScore,
    rating,
    sector,
    exchange,
    sort = "overallScore",
    order = "desc",
    page = "1",
    limit = "20",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Build Mongo filter
  const filter: Record<string, unknown> = {};

  if (minScore !== undefined || maxScore !== undefined) {
    const scoreFilter: Record<string, number> = {};
    if (minScore !== undefined) scoreFilter.$gte = Number(minScore);
    if (maxScore !== undefined) scoreFilter.$lte = Number(maxScore);
    filter["result.overallScore"] = scoreFilter;
  }

  if (rating && VALID_RATINGS.includes(rating as (typeof VALID_RATINGS)[number])) {
    filter["result.analystRating"] = rating.toUpperCase();
  }

  if (sector) {
    filter["rawInput.sector"] = { $regex: new RegExp(sector, "i") };
  }

  if (exchange) {
    filter["rawInput.exchange"] = { $regex: new RegExp(exchange, "i") };
  }

  // Build sort
  const sortField = VALID_SORT_FIELDS.includes(sort as (typeof VALID_SORT_FIELDS)[number]) ? sort : "overallScore";
  const mongoSortField = sortField === "overallScore" ? "result.overallScore" : "createdAt";
  const sortDir = order === "asc" ? 1 : -1;

  const [docs, total] = await Promise.all([
    AnalysisModel.find(filter, {
      ticker: 1,
      createdAt: 1,
      "result.overallScore": 1,
      "result.analystRating": 1,
      "result.ratingReason": 1,
      "result.targetPrices": 1,
      "result.technicalSummary.trend": 1,
      "result.fundamentalSummary.valuationStatus": 1,
      "rawInput.sector": 1,
      "rawInput.exchange": 1,
      "rawInput.companyName": 1,
      "rawInput.currentPrice": 1,
    })
      .sort({ [mongoSortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AnalysisModel.countDocuments(filter),
  ]);

  res.json({
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
    results: docs.map((d) => ({
      ticker: d.ticker,
      createdAt: d.createdAt,
      overallScore: (d as any).result?.overallScore,
      analystRating: (d as any).result?.analystRating,
      ratingReason: (d as any).result?.ratingReason,
      targetPrices: (d as any).result?.targetPrices,
      trend: (d as any).result?.technicalSummary?.trend,
      valuationStatus: (d as any).result?.fundamentalSummary?.valuationStatus,
      sector: (d as any).rawInput?.sector,
      exchange: (d as any).rawInput?.exchange,
      companyName: (d as any).rawInput?.companyName,
      currentPrice: (d as any).rawInput?.currentPrice,
    })),
  });
});
