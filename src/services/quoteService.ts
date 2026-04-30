import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

export type Quote = {
  currentPrice: number;
  change: number;
  changePercent: number;
};

function ensureFinnhubKey(): string {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new AppError("Missing Finnhub API key", { statusCode: 500, code: "MISSING_FINNHUB_KEY" });
  return key;
}

const quoteSchema = z.object({
  c: z.number(),
  d: z.number(),
  dp: z.number(),
});

export async function fetchQuote(ticker: string): Promise<Quote> {
  const token = ensureFinnhubKey();
  const { data } = await http.get("https://finnhub.io/api/v1/quote", {
    params: { symbol: ticker, token },
  });

  const parsed = quoteSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("Finnhub quote parse error", { statusCode: 502, code: "FINNHUB_BAD_RESPONSE", details: parsed.error.flatten() });
  }
  return { currentPrice: parsed.data.c, change: parsed.data.d, changePercent: parsed.data.dp };
}

