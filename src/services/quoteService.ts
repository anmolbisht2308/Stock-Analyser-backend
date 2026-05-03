import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type Quote = {
  currentPrice: number;
  change: number;
  changePercent: number;
};

export async function fetchQuote(ticker: string): Promise<Quote> {
  try {
    const data = (await yf.quote(ticker)) as any;
    
    return { 
      currentPrice: data.regularMarketPrice ?? 0, 
      change: data.regularMarketChange ?? 0, 
      changePercent: data.regularMarketChangePercent ?? 0 
    };
  } catch (err: unknown) {
    const e = err as Error;
    throw new AppError("Yahoo Finance quote request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err) },
    });
  }
}
