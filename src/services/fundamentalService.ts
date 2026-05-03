import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type Fundamentals = {
  peRatio: number;
  pbRatio: number;
  psRatio: number;
  debtToEquity: number;
  roe: number;
  roa: number;
  revenueGrowthYoY: number;
  earningsGrowthYoY: number;
  freeCashFlow: number;
  currentRatio: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  eps: number;
  forwardPE: number;
  pegRatio: number;
  marketCap: number;
  enterpriseValue: number;
  dividendYield: number;
  payoutRatio: number;
};

function num(x: number | null | undefined, fallback = 0): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

export async function fetchFundamentals(ticker: string): Promise<Fundamentals> {
  try {
    const summary = (await yf.quoteSummary(ticker, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail"]
    })) as any;

    const fd = (summary.financialData || {}) as any;
    const dks = (summary.defaultKeyStatistics || {}) as any;
    const sd = (summary.summaryDetail || {}) as any;

    return {
      peRatio: num(sd.trailingPE),
      pbRatio: num(dks.priceToBook),
      psRatio: num(sd.priceToSalesTrailing12Months),
      debtToEquity: num(fd.debtToEquity),
      roe: num(fd.returnOnEquity),
      roa: num(fd.returnOnAssets),
      revenueGrowthYoY: num(fd.revenueGrowth),
      earningsGrowthYoY: num(fd.earningsGrowth),
      freeCashFlow: num(fd.freeCashflow),
      currentRatio: num(fd.currentRatio),
      grossMargin: num(fd.grossMargins),
      operatingMargin: num(fd.operatingMargins),
      netMargin: num(fd.profitMargins),
      eps: num(dks.trailingEps),
      forwardPE: num(sd.forwardPE),
      pegRatio: num(dks.pegRatio),
      marketCap: num(sd.marketCap),
      enterpriseValue: num(dks.enterpriseValue),
      dividendYield: num(sd.dividendYield),
      payoutRatio: num(sd.payoutRatio),
    };
  } catch (err: unknown) {
    const e = err as Error;
    throw new AppError("Yahoo Finance fundamentals request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err) },
    });
  }
}
