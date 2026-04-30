import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

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

function ensureFmpKey(): string {
  const key = process.env.FMP_KEY;
  if (!key) throw new AppError("Missing FMP API key", { statusCode: 500, code: "MISSING_FMP_KEY" });
  return key;
}

// FMP "stable" API schemas (post-legacy)
const ratiosTtmStableSchema = z.array(
  z.object({
    priceToEarningsRatioTTM: z.number().optional(),
    priceToBookRatioTTM: z.number().optional(),
    priceToSalesRatioTTM: z.number().optional(),
    debtEquityRatioTTM: z.number().optional(),
    returnOnEquityTTM: z.number().optional(),
    returnOnAssetsTTM: z.number().optional(),
    currentRatioTTM: z.number().optional(),
    grossProfitMarginTTM: z.number().optional(),
    operatingProfitMarginTTM: z.number().optional(),
    netProfitMarginTTM: z.number().optional(),
    dividendYieldTTM: z.number().optional(),
    payoutRatioTTM: z.number().optional(),
    priceToEarningsGrowthRatioTTM: z.number().optional() // PEG (TTM)
  }),
);

const keyMetricsTtmStableSchema = z.array(
  z.object({
    enterpriseValueTTM: z.number().optional(),
    marketCapTTM: z.number().optional(),
    peRatioTTM: z.number().optional(),
    pbRatioTTM: z.number().optional(),
    epsTTM: z.number().optional(),
  }),
);

const growthStableSchema = z.array(
  z.object({
    revenueGrowth: z.number().optional(),
    netIncomeGrowth: z.number().optional(),
    epsGrowth: z.number().optional(),
  }),
);

const cashFlowTtmStableSchema = z.array(
  z.object({
    freeCashFlowTTM: z.number().optional(),
    freeCashFlow: z.number().optional(),
  }),
);

const quoteStableSchema = z.array(
  z.object({
    price: z.number().optional(),
    marketCap: z.number().optional(),
    eps: z.number().optional(),
    enterpriseValue: z.number().optional(),
  }),
);

const analystEstimatesSchema = z.array(
  z.object({
    date: z.string().optional(), // fiscal year or period label
    epsAvg: z.number().optional(),
  }),
);

function num(x: number | null | undefined, fallback = 0): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

export async function fetchFundamentals(ticker: string): Promise<Fundamentals> {
  const apikey = ensureFmpKey();
  const base = "https://financialmodelingprep.com/stable";

  let ratiosRes, keyMetricsRes, growthRes, fcfRes, quoteRes, estRes;
  try {
    [ratiosRes, keyMetricsRes, growthRes, fcfRes, quoteRes, estRes] = await Promise.all([
      http.get(`${base}/ratios-ttm`, { params: { symbol: ticker, apikey } }),
      http.get(`${base}/key-metrics-ttm`, { params: { symbol: ticker, apikey } }),
      http.get(`${base}/financial-growth`, { params: { symbol: ticker, limit: 1, apikey } }),
      http.get(`${base}/cash-flow-statement-ttm`, { params: { symbol: ticker, apikey } }),
      http.get(`${base}/quote`, { params: { symbol: ticker, apikey } }),
      http.get(`${base}/analyst-estimates`, { params: { symbol: ticker, period: "annual", page: 0, limit: 4, apikey } }),
    ]);
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const status = e.response?.status;
    if (status === 403) {
      throw new AppError("FMP forbidden for this API key/plan", {
        statusCode: 403,
        code: "FMP_FORBIDDEN",
        details: { ticker, fmp: e.response?.data ?? null },
      });
    }
    throw new AppError("FMP request failed", {
      statusCode: status && status >= 400 && status < 600 ? status : 502,
      code: "FMP_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err), fmp: e.response?.data ?? null },
    });
  }

  const ratios = ratiosTtmStableSchema.safeParse(ratiosRes.data);
  const keyMetrics = keyMetricsTtmStableSchema.safeParse(keyMetricsRes.data);
  const growth = growthStableSchema.safeParse(growthRes.data);
  const fcf = cashFlowTtmStableSchema.safeParse(fcfRes.data);
  const quote = quoteStableSchema.safeParse(quoteRes.data);
  const estimates = analystEstimatesSchema.safeParse(estRes.data);

  if (!ratios.success || !keyMetrics.success || !growth.success || !fcf.success || !quote.success || !estimates.success) {
    throw new AppError("FMP parse error", {
      statusCode: 502,
      code: "FMP_BAD_RESPONSE",
      details: {
        ratios: ratios.success ? null : ratios.error.flatten(),
        keyMetrics: keyMetrics.success ? null : keyMetrics.error.flatten(),
        growth: growth.success ? null : growth.error.flatten(),
        cashFlow: fcf.success ? null : fcf.error.flatten(),
        quote: quote.success ? null : quote.error.flatten(),
        estimates: estimates.success ? null : estimates.error.flatten(),
      },
    });
  }

  const r = ratios.data[0] ?? {};
  const km = keyMetrics.data[0] ?? {};
  const g = growth.data[0] ?? {};
  const q = quote.data[0] ?? {};
  const cf = fcf.data[0] ?? {};
  const est = estimates.data.find((x) => typeof x.epsAvg === "number" && x.epsAvg > 0) ?? {};

  const price = num(q.price);
  const forwardEps = num((est as any).epsAvg);
  const forwardPE = forwardEps > 0 && price > 0 ? price / forwardEps : 0;

  return {
    peRatio: num((km as any).peRatioTTM ?? (r as any).priceToEarningsRatioTTM),
    pbRatio: num((km as any).pbRatioTTM ?? (r as any).priceToBookRatioTTM),
    psRatio: num((r as any).priceToSalesRatioTTM),
    debtToEquity: num((r as any).debtEquityRatioTTM),
    roe: num((r as any).returnOnEquityTTM),
    roa: num((r as any).returnOnAssetsTTM),
    revenueGrowthYoY: num(g.revenueGrowth),
    earningsGrowthYoY: num(g.netIncomeGrowth ?? g.epsGrowth),
    freeCashFlow: num((cf as any).freeCashFlowTTM ?? (cf as any).freeCashFlow),
    currentRatio: num((r as any).currentRatioTTM),
    grossMargin: num((r as any).grossProfitMarginTTM),
    operatingMargin: num((r as any).operatingProfitMarginTTM),
    netMargin: num((r as any).netProfitMarginTTM),
    eps: num(q.eps ?? (km as any).epsTTM),
    forwardPE,
    pegRatio: num((r as any).priceToEarningsGrowthRatioTTM),
    marketCap: num(q.marketCap ?? (km as any).marketCapTTM),
    enterpriseValue: num(q.enterpriseValue ?? (km as any).enterpriseValueTTM),
    dividendYield: num((r as any).dividendYieldTTM),
    payoutRatio: num((r as any).payoutRatioTTM),
  };
}

