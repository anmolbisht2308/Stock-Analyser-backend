import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

export type OHLCVBar = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const alphaTimeSeriesSchema = z.object({
  "Time Series (Daily)": z.record(
    z.object({
      "1. open": z.string(),
      "2. high": z.string(),
      "3. low": z.string(),
      "4. close": z.string(),
      "6. volume": z.string().optional(),
      "5. volume": z.string().optional(),
    }),
  ),
  "Error Message": z.string().optional(),
  Note: z.string().optional(),
});

function ensureAlphaKey(): string {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new AppError("Missing Alpha Vantage API key", { statusCode: 500, code: "MISSING_ALPHA_VANTAGE_KEY" });
  return key;
}

export async function fetchDailyOHLCV(ticker: string): Promise<OHLCVBar[]> {
  const apikey = ensureAlphaKey();
  const url = "https://www.alphavantage.co/query";

  const { data } = await http.get(url, {
    params: {
      function: "TIME_SERIES_DAILY",
      symbol: ticker,
      outputsize: "compact",
      apikey,
    },
  });

  const parsed = alphaTimeSeriesSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("Alpha Vantage parse error", { statusCode: 502, code: "ALPHA_VANTAGE_BAD_RESPONSE", details: parsed.error.flatten() });
  }

  if (parsed.data["Error Message"]) {
    throw new AppError("Alpha Vantage error", { statusCode: 502, code: "ALPHA_VANTAGE_ERROR", details: parsed.data["Error Message"] });
  }
  if (parsed.data.Note) {
    throw new AppError("Alpha Vantage rate limited", { statusCode: 429, code: "ALPHA_VANTAGE_RATE_LIMIT", details: parsed.data.Note });
  }

  const series = parsed.data["Time Series (Daily)"];
  const bars: OHLCVBar[] = Object.entries(series)
    .map(([date, v]) => {
      const vol = v["6. volume"] ?? v["5. volume"] ?? "0";
      return {
        date,
        open: Number(v["1. open"]),
        high: Number(v["2. high"]),
        low: Number(v["3. low"]),
        close: Number(v["4. close"]),
        volume: Number(vol),
      };
    })
    .filter((b) => Number.isFinite(b.close) && Number.isFinite(b.volume))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (bars.length < 60) {
    throw new AppError("Insufficient OHLCV history", { statusCode: 502, code: "INSUFFICIENT_OHLCV", details: { ticker, points: bars.length } });
  }

  return bars;
}

