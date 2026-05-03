import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type SearchResult = { symbol: string; description: string; type: string };

function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function searchSymbols(q: string): Promise<SearchResult[]> {
  const query = normalizeQuery(q);

  try {
    const results = await yf.search(query, { quotesCount: 20, newsCount: 0 });
    
    return (results as any).quotes
      .filter((r: any) => r.symbol && (r.shortname || r.longname))
      .map((r: any) => ({
        symbol: String(r.symbol),
        description: String(r.longname || r.shortname || r.symbol),
        type: String(r.quoteType || "EQUITY"),
      }));
  } catch (err: unknown) {
    const e = err as Error;
    throw new AppError("Yahoo Finance search request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { q, message: e.message ?? String(err) },
    });
  }
}
