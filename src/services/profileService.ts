import { z } from "zod";
import { http } from "./httpClient";
import { AppError } from "../utils/AppError";

export type CompanyProfile = {
  companyName: string;
  sector: string;
  industry: string;
  exchange: string;
};

function ensureFinnhubKey(): string {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new AppError("Missing Finnhub API key", { statusCode: 500, code: "MISSING_FINNHUB_KEY" });
  return key;
}

const profileSchema = z.object({
  name: z.string().optional(),
  finnhubIndustry: z.string().optional(),
  exchange: z.string().optional(),
});

const fmpProfileSchema = z.array(
  z.object({
    companyName: z.string().optional(),
    sector: z.string().optional(),
    industry: z.string().optional(),
    exchangeShortName: z.string().optional(),
  }),
);

function ensureFmpKey(): string {
  const key = process.env.FMP_KEY;
  if (!key) throw new AppError("Missing FMP API key", { statusCode: 500, code: "MISSING_FMP_KEY" });
  return key;
}

export async function fetchCompanyProfile(ticker: string): Promise<CompanyProfile> {
  const token = ensureFinnhubKey();
  const apikey = ensureFmpKey();

  const [fhRes, fmpRes] = await Promise.allSettled([
    http.get("https://finnhub.io/api/v1/stock/profile2", { params: { symbol: ticker, token } }),
    http.get("https://financialmodelingprep.com/stable/profile", { params: { symbol: ticker, apikey } }),
  ]);

  const fh =
    fhRes.status === "fulfilled" ? profileSchema.safeParse(fhRes.value.data) : { success: false as const, error: null };
  const fmp =
    fmpRes.status === "fulfilled"
      ? fmpProfileSchema.safeParse(fmpRes.value.data)
      : { success: false as const, error: null };

  const companyName = (fmp.success ? fmp.data[0]?.companyName : undefined) ?? (fh.success ? fh.data.name : undefined) ?? ticker;
  const sector = (fmp.success ? fmp.data[0]?.sector : undefined) ?? "Unknown";
  const industry = (fmp.success ? fmp.data[0]?.industry : undefined) ?? (fh.success ? fh.data.finnhubIndustry : undefined) ?? "Unknown";
  const exchange = (fmp.success ? fmp.data[0]?.exchangeShortName : undefined) ?? (fh.success ? fh.data.exchange : undefined) ?? "Unknown";

  return {
    companyName,
    sector,
    industry,
    exchange,
  };
}

