import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

export type NewsItem = { headline: string; source: string; publishedAt: string; url?: string };

const finnhubNewsSchema = z.array(
  z.object({
    headline: z.string(),
    source: z.string(),
    datetime: z.number(),
    url: z.string().optional(),
  }),
);

function ensureFinnhubKey(): string {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new AppError("Missing Finnhub API key", { statusCode: 500, code: "MISSING_FINNHUB_KEY" });
  return key;
}

export async function fetchCompanyNews(ticker: string, limit: number): Promise<NewsItem[]> {
  const token = ensureFinnhubKey();
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 14);

  let data: unknown;
  try {
    const res = await http.get("https://finnhub.io/api/v1/company-news", {
      params: {
        symbol: ticker,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        token,
      },
    });
    data = res.data;
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const status = e.response?.status;
    if (status === 403) {
      throw new AppError("Finnhub news forbidden for this API key/plan", {
        statusCode: 403,
        code: "FINNHUB_FORBIDDEN",
        details: { ticker, finnhub: e.response?.data ?? null },
      });
    }
    throw new AppError("Finnhub news request failed", {
      statusCode: status && status >= 400 && status < 600 ? status : 502,
      code: "FINNHUB_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err), finnhub: e.response?.data ?? null },
    });
  }

  const parsed = finnhubNewsSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("Finnhub news parse error", { statusCode: 502, code: "FINNHUB_BAD_RESPONSE", details: parsed.error.flatten() });
  }

  const dedup = new Map<string, NewsItem>();
  for (const item of parsed.data) {
    const key = `${item.source}:${item.headline}`.toLowerCase();
    if (!dedup.has(key)) {
      const base: NewsItem = {
        headline: item.headline,
        source: item.source,
        publishedAt: new Date(item.datetime * 1000).toISOString(),
      };
      if (item.url) base.url = item.url;
      dedup.set(key, base);
    }
  }

  return Array.from(dedup.values())
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, Math.max(1, Math.min(50, limit)));
}

