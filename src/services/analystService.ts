import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type AnalystRating = { firm: string; rating: string; targetPrice: number };

export async function fetchAnalystRatings(ticker: string): Promise<AnalystRating[]> {
  try {
    const summary = (await yf.quoteSummary(ticker, {
      modules: ["financialData", "recommendationTrend"]
    })) as any;

    const fd = (summary.financialData || {}) as any;
    const summaryRatings: AnalystRating[] = [];

    // Overall Consensus
    if (fd.recommendationKey && typeof fd.targetMeanPrice === 'number') {
      const rec = String(fd.recommendationKey).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      summaryRatings.push({
        firm: "Consensus (Yahoo)",
        rating: rec,
        targetPrice: fd.targetMeanPrice
      });
    }

    if (typeof fd.targetHighPrice === 'number') {
      summaryRatings.push({
        firm: "Price Target (High)",
        rating: "Target High",
        targetPrice: fd.targetHighPrice
      });
    }
    if (typeof fd.targetMedianPrice === 'number') {
      summaryRatings.push({
        firm: "Price Target (Median)",
        rating: "Target Median",
        targetPrice: fd.targetMedianPrice
      });
    }
    if (typeof fd.targetLowPrice === 'number') {
      summaryRatings.push({
        firm: "Price Target (Low)",
        rating: "Target Low",
        targetPrice: fd.targetLowPrice
      });
    }

    return summaryRatings.filter((x) => Number.isFinite(x.targetPrice));
  } catch (err: unknown) {
    const e = err as Error;
    throw new AppError("Yahoo Finance analyst ratings request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err) },
    });
  }
}
