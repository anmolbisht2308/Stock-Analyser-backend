import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

export type AnalystRating = { firm: string; rating: string; targetPrice: number };

function ensureFinnhubKey(): string {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new AppError("Missing Finnhub API key", { statusCode: 500, code: "MISSING_FINNHUB_KEY" });
  return key;
}

const recommendationSchema = z.array(
  z.object({
    period: z.string(),
    strongBuy: z.number(),
    buy: z.number(),
    hold: z.number(),
    sell: z.number(),
    strongSell: z.number(),
  }),
);

const priceTargetSchema = z.object({
  targetHigh: z.number(),
  targetLow: z.number(),
  targetMean: z.number(),
  targetMedian: z.number(),
});

export async function fetchAnalystRatings(ticker: string): Promise<AnalystRating[]> {
  const token = ensureFinnhubKey();

  const [recRes, tgtRes] = await Promise.allSettled([
    http.get("https://finnhub.io/api/v1/stock/recommendation", { params: { symbol: ticker, token } }),
    http.get("https://finnhub.io/api/v1/stock/price-target", { params: { symbol: ticker, token } }),
  ]);

  const recParsed =
    recRes.status === "fulfilled"
      ? recommendationSchema.safeParse(recRes.value.data)
      : ({ success: false as const, error: recRes.reason } as const);

  const tgtParsed =
    tgtRes.status === "fulfilled"
      ? priceTargetSchema.safeParse(tgtRes.value.data)
      : ({ success: false as const, error: tgtRes.reason } as const);

  if (!recParsed.success && !tgtParsed.success) {
    throw new AppError("Finnhub analyst endpoints unavailable", {
      statusCode: 502,
      code: "FINNHUB_REQUEST_FAILED",
      details: { recommendation: recRes.status === "rejected" ? String(recRes.reason) : null, priceTarget: tgtRes.status === "rejected" ? String(tgtRes.reason) : null },
    });
  }

  const latest = recParsed.success ? recParsed.data[0] : undefined;
  const t = tgtParsed.success ? tgtParsed.data : undefined;

  // Finnhub doesn't provide per-firm targets on free tier; we convert to a few aggregate "firms"
  // so Groq receives a structured rating + target distribution without fabricating values.
  const summary: AnalystRating[] = [];
  if (latest) {
    const score =
      latest.strongBuy * 2 + latest.buy * 1 + latest.hold * 0 + latest.sell * -1 + latest.strongSell * -2;
    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
    const avg = total > 0 ? score / total : 0;
    const rating =
      avg >= 1.2 ? "Strong Buy" : avg >= 0.5 ? "Buy" : avg >= -0.5 ? "Hold" : avg >= -1.2 ? "Sell" : "Strong Sell";

    // If price-target is blocked (403) on the plan, don't fabricate targets — just omit them.
    if (t) summary.push({ firm: "Consensus (Finnhub)", rating, targetPrice: t.targetMean });
  }
  if (t) {
    summary.push({ firm: "Price Target (High)", rating: "Target High", targetPrice: t.targetHigh });
    summary.push({ firm: "Price Target (Median)", rating: "Target Median", targetPrice: t.targetMedian });
    summary.push({ firm: "Price Target (Low)", rating: "Target Low", targetPrice: t.targetLow });
  }

  return summary.filter((x) => Number.isFinite(x.targetPrice));
}

