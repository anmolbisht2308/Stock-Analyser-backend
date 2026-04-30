import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

export type SearchResult = { symbol: string; description: string; type: string };

function ensureFinnhubKey(): string {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new AppError("Missing Finnhub API key", { statusCode: 500, code: "MISSING_FINNHUB_KEY" });
  return key;
}

const searchSchema = z.object({
  result: z.array(
    z.object({
      symbol: z.string(),
      description: z.string(),
      type: z.string().optional().default(""),
    }),
  ),
});

function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").slice(0, 80);
}

function mapResults(data: unknown): SearchResult[] {
  const parsed = searchSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("Finnhub search parse error", {
      statusCode: 502,
      code: "FINNHUB_BAD_RESPONSE",
      details: parsed.error.flatten(),
    });
  }

  return parsed.data.result
    .filter((r) => r.symbol && r.description)
    .slice(0, 20)
    .map((r) => ({ symbol: r.symbol, description: r.description, type: r.type }));
}

async function finnhubSearchOnce(q: string, token: string): Promise<SearchResult[]> {
  try {
    const { data } = await http.get("https://finnhub.io/api/v1/search", {
      params: { q, token },
    });
    return mapResults(data);
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const status = e.response?.status;

    // Finnhub sometimes returns 422 for multi-word/company-name queries.
    // We handle it in the caller with retries instead of leaking a 500.
    if (status === 422) {
      throw new AppError("Finnhub search rejected query", {
        statusCode: 422,
        code: "FINNHUB_QUERY_REJECTED",
        details: { q, finnhub: e.response?.data ?? null },
      });
    }

    throw new AppError("Finnhub search request failed", {
      statusCode: status && status >= 400 && status < 600 ? status : 502,
      code: "FINNHUB_REQUEST_FAILED",
      details: { q, message: e.message ?? String(err), finnhub: e.response?.data ?? null },
    });
  }
}

export async function searchSymbols(q: string): Promise<SearchResult[]> {
  const token = ensureFinnhubKey();
  const query = normalizeQuery(q);

  try {
    return await finnhubSearchOnce(query, token);
  } catch (err: unknown) {
    // If Finnhub rejects the multi-word query, retry with a narrower query (still real Finnhub data).
    if (err instanceof AppError && err.code === "FINNHUB_QUERY_REJECTED") {
      const parts = query.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        // Prefer the most distinctive token (usually the first word for brand names).
        const fallback = parts[0] ?? query;
        return await finnhubSearchOnce(fallback, token);
      }
    }
    throw err;
  }
}

