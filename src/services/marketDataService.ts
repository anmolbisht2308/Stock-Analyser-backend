import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type OHLCVBar = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function fetchDailyOHLCV(ticker: string): Promise<OHLCVBar[]> {
  try {
    const today = new Date();
    const from = new Date();
    // Fetch last 120 days to comfortably have >=60 trading days (accounting for weekends/holidays)
    from.setDate(today.getDate() - 120);

    const chart = await yf.chart(ticker, {
      period1: from,
      period2: today,
      interval: "1d",
    });

    const bars: OHLCVBar[] = (chart as any).quotes
      .filter((q: any) => q.date && q.open !== null && q.high !== null && q.low !== null && q.close !== null)
      .map((q: any) => {
        const date = q.date as Date;
        return {
          date: date.toISOString().slice(0, 10),
          open: Number(q.open),
          high: Number(q.high),
          low: Number(q.low),
          close: Number(q.close),
          volume: Number(q.volume ?? 0),
        };
      })
      .filter((b: OHLCVBar) => Number.isFinite(b.close) && Number.isFinite(b.volume))
      .sort((a: OHLCVBar, b: OHLCVBar) => (a.date < b.date ? -1 : 1));

    if (bars.length < 60) {
      throw new AppError("Insufficient OHLCV history", {
        statusCode: 502,
        code: "INSUFFICIENT_OHLCV",
        details: { ticker, points: bars.length },
      });
    }

    return bars;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const e = err as Error;
    throw new AppError("Yahoo Finance chart request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err) },
    });
  }
}
