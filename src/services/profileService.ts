import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type CompanyProfile = {
  companyName: string;
  sector: string;
  industry: string;
  exchange: string;
};

export async function fetchCompanyProfile(ticker: string): Promise<CompanyProfile> {
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["summaryProfile", "quoteType", "price"]
    });

    const sp = (summary.summaryProfile || {}) as any;
    const qt = (summary.quoteType || {}) as any;
    const p = (summary.price || {}) as any;

    const companyName = p.longName || p.shortName || qt.longName || qt.shortName || ticker;
    const sector = sp.sector || "Unknown";
    const industry = sp.industry || "Unknown";
    const exchange = qt.exchange || p.exchangeName || "Unknown";

    return {
      companyName,
      sector,
      industry,
      exchange,
    };
  } catch (err: unknown) {
    const e = err as Error;
    throw new AppError("Yahoo Finance profile request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err) },
    });
  }
}
