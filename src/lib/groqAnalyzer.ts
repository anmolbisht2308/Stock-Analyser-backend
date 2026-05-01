import client from "./groq";
import { z } from "zod";
import { logger } from "./logger";
import { AppError } from "../utils/AppError";
import { TokenUsageLogModel } from "../models/TokenUsageLog.model";

export const analysisInputSchema = z.object({
  ticker: z.string().min(1),
  companyName: z.string().min(1),
  currentPrice: z.number().positive(),
  priceHistory: z.array(
    z.object({
      date: z.string().min(1),
      close: z.number().positive(),
      volume: z.number().nonnegative(),
    }),
  ),
  technicals: z.record(z.unknown()),
  fundamentals: z.record(z.unknown()),
  recentNews: z.array(
    z.object({
      headline: z.string(),
      source: z.string(),
      publishedAt: z.string(),
    }),
  ),
  analystRatings: z.array(
    z.object({
      firm: z.string(),
      rating: z.string(),
      targetPrice: z.number().nonnegative(),
    }),
  ),
  sector: z.string(),
  industry: z.string(),
  exchange: z.string(),
});

export type AnalysisInput = z.infer<typeof analysisInputSchema>;

export const groqAnalysisResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  analystRating: z.enum(["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"]),
  ratingReason: z.string(),

  multibaggerProbability: z.object({
    within1Year: z.number().min(0).max(100),
    within2Years: z.number().min(0).max(100),
    within3Years: z.number().min(0).max(100),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    reasoning: z.string(),
  }),

  targetProbabilities: z.object({
    twoX: z.object({ within1Y: z.number().min(0).max(100), within2Y: z.number().min(0).max(100), within3Y: z.number().min(0).max(100) }),
    threeX: z.object({ within1Y: z.number().min(0).max(100), within2Y: z.number().min(0).max(100), within3Y: z.number().min(0).max(100) }),
    fourX: z.object({ within1Y: z.number().min(0).max(100), within2Y: z.number().min(0).max(100), within3Y: z.number().min(0).max(100) }),
  }),

  targetPrices: z.object({
    conservative: z.number().nonnegative(),
    base: z.number().nonnegative(),
    optimistic: z.number().nonnegative(),
    timeHorizon: z.string(),
  }),

  technicalSummary: z.object({
    trend: z.enum(["STRONG UPTREND", "UPTREND", "SIDEWAYS", "DOWNTREND", "STRONG DOWNTREND"]),
    momentum: z.enum(["BULLISH", "NEUTRAL", "BEARISH"]),
    supportLevels: z.array(z.number().positive()),
    resistanceLevels: z.array(z.number().positive()),
    keyPatterns: z.array(z.string()),
    technicalScore: z.number().min(0).max(100),
    signals: z.array(
      z.object({
        name: z.string(),
        value: z.string(),
        interpretation: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
      }),
    ),
  }),

  fundamentalSummary: z.object({
    valuationStatus: z.enum(["UNDERVALUED", "FAIRLY VALUED", "OVERVALUED"]),
    growthOutlook: z.enum(["STRONG", "MODERATE", "WEAK", "NEGATIVE"]),
    financialHealth: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]),
    fundamentalScore: z.number().min(0).max(100),
    keyStrengths: z.array(z.string()),
    keyRisks: z.array(z.string()),
  }),

  newsSentiment: z.object({
    overall: z.enum(["VERY POSITIVE", "POSITIVE", "NEUTRAL", "NEGATIVE", "VERY NEGATIVE"]),
    sentimentScore: z.number().min(-100).max(100),
    catalysts: z.array(z.string()),
    risks: z.array(z.string()),
  }),

  investmentThesis: z.string(),
  catalystsForGrowth: z.array(z.string()),
  majorRisks: z.array(z.string()),
  comparablePeers: z.array(z.string()),
  suggestedTimeHorizon: z.string(),
  entryStrategy: z.string(),
  exitStrategy: z.string(),
});

export type GroqAnalysisResult = z.infer<typeof groqAnalysisResultSchema>;

function pickGroqModel(prefer: "primary" | "fallback"): string {
  if (prefer === "fallback") return "llama-3.1-8b-instant";
  return "llama-3.3-70b-versatile";
}

function clamp01to100(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const found = allowed.find((a) => a === raw);
  return found ?? fallback;
}

function normalizeResultShape(rawObj: unknown): unknown {
  if (!rawObj || typeof rawObj !== "object") return rawObj;
  const obj: any = rawObj;

  obj.analystRating = normalizeEnum(obj.analystRating, ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"] as const, "HOLD");

  if (Array.isArray(obj?.technicalSummary?.signals)) {
    obj.technicalSummary.signals = obj.technicalSummary.signals.map((s: any) => {
      const name = typeof s?.name === "string" ? s.name : typeof s?.indicator === "string" ? s.indicator : "";
      const value = typeof s?.value === "string" ? s.value : typeof s?.value === "number" ? String(s.value) : String(s?.value ?? "");
      const interpretation = normalizeEnum(s?.interpretation, ["BULLISH", "BEARISH", "NEUTRAL"] as const, "NEUTRAL");
      return { name, value, interpretation };
    });
  }

  if (obj?.multibaggerProbability) {
    obj.multibaggerProbability.within1Year = clamp01to100(obj.multibaggerProbability.within1Year);
    obj.multibaggerProbability.within2Years = clamp01to100(obj.multibaggerProbability.within2Years);
    obj.multibaggerProbability.within3Years = clamp01to100(obj.multibaggerProbability.within3Years);
    obj.multibaggerProbability.confidence = normalizeEnum(obj.multibaggerProbability.confidence, ["LOW", "MEDIUM", "HIGH"] as const, "LOW");
  }

  if (obj?.targetProbabilities) {
    for (const k of ["twoX", "threeX", "fourX"] as const) {
      const block = obj.targetProbabilities?.[k];
      if (block) {
        block.within1Y = clamp01to100(block.within1Y);
        block.within2Y = clamp01to100(block.within2Y);
        block.within3Y = clamp01to100(block.within3Y);
      }
    }
  }

  if (obj?.newsSentiment) {
    obj.newsSentiment.overall = normalizeEnum(
      obj.newsSentiment.overall,
      ["VERY POSITIVE", "POSITIVE", "NEUTRAL", "NEGATIVE", "VERY NEGATIVE"] as const,
      "NEUTRAL",
    );
  }

  if (obj?.technicalSummary) {
    obj.technicalSummary.trend = normalizeEnum(
      obj.technicalSummary.trend,
      ["STRONG UPTREND", "UPTREND", "SIDEWAYS", "DOWNTREND", "STRONG DOWNTREND"] as const,
      "SIDEWAYS",
    );
    obj.technicalSummary.momentum = normalizeEnum(obj.technicalSummary.momentum, ["BULLISH", "NEUTRAL", "BEARISH"] as const, "NEUTRAL");
  }

  if (obj?.fundamentalSummary) {
    obj.fundamentalSummary.valuationStatus = normalizeEnum(
      obj.fundamentalSummary.valuationStatus,
      ["UNDERVALUED", "FAIRLY VALUED", "OVERVALUED"] as const,
      "FAIRLY VALUED",
    );
    obj.fundamentalSummary.growthOutlook = normalizeEnum(
      obj.fundamentalSummary.growthOutlook,
      ["STRONG", "MODERATE", "WEAK", "NEGATIVE"] as const,
      "MODERATE",
    );
    obj.fundamentalSummary.financialHealth = normalizeEnum(
      obj.fundamentalSummary.financialHealth,
      ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const,
      "FAIR",
    );
  }

  return obj;
}

function buildCompactPriceContext(input: AnalysisInput): {
  priceHistorySample: AnalysisInput["priceHistory"];
  priceSummary: Record<string, number>;
} {
  const series = input.priceHistory.slice(-120);
  const closes = series.map((p) => p.close);
  const volumes = series.map((p) => p.volume);

  const hi90 = Math.max(...closes.slice(-90));
  const lo90 = Math.min(...closes.slice(-90));
  const lastClose = closes[closes.length - 1] ?? input.currentPrice;
  const ret20 = closes.length >= 21 ? (lastClose / (closes[closes.length - 21] ?? lastClose) - 1) * 100 : 0;
  const ret60 = closes.length >= 61 ? (lastClose / (closes[closes.length - 61] ?? lastClose) - 1) * 100 : 0;
  const avgVol20 =
    volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : volumes.reduce((a, b) => a + b, 0) / Math.max(1, volumes.length);

  return {
    priceHistorySample: input.priceHistory.slice(-30),
    priceSummary: {
      lastClose,
      high90: hi90,
      low90: lo90,
      return20D_pct: ret20,
      return60D_pct: ret60,
      avgVolume20: avgVol20,
    },
  };
}

export async function analyzeStock(input: AnalysisInput): Promise<GroqAnalysisResult> {
  const systemPrompt = `You are an elite quantitative analyst and portfolio manager with
20+ years experience at top-tier hedge funds (Renaissance Technologies, Citadel, Two Sigma).
You specialize in identifying multibagger stocks using technical analysis, fundamental analysis,
news sentiment, and macroeconomic context.

Your analysis is data-driven, precise, and actionable. You never give vague answers.
You ALWAYS respond in valid JSON format only — no markdown, no explanation outside JSON.
Every probability you give is based on rigorous analysis of the provided data.
Be realistic: not every stock is a multibagger. Score conservatively and accurately.`;

  const { priceHistorySample, priceSummary } = buildCompactPriceContext(input);

  const enumRules = `ENUM RULES (MUST FOLLOW EXACTLY):
- analystRating: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL"
- multibaggerProbability.confidence: "LOW" | "MEDIUM" | "HIGH"
- technicalSummary.trend: "STRONG UPTREND" | "UPTREND" | "SIDEWAYS" | "DOWNTREND" | "STRONG DOWNTREND"
- technicalSummary.momentum: "BULLISH" | "NEUTRAL" | "BEARISH"
- technicalSummary.signals[].interpretation: "BULLISH" | "BEARISH" | "NEUTRAL"
- fundamentalSummary.valuationStatus: "UNDERVALUED" | "FAIRLY VALUED" | "OVERVALUED"
- fundamentalSummary.growthOutlook: "STRONG" | "MODERATE" | "WEAK" | "NEGATIVE"
- fundamentalSummary.financialHealth: "EXCELLENT" | "GOOD" | "FAIR" | "POOR"
- newsSentiment.overall: "VERY POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "VERY NEGATIVE"`;

  const requiredTopLevelKeys =
    `"overallScore","analystRating","ratingReason","multibaggerProbability","targetProbabilities","targetPrices","technicalSummary","fundamentalSummary","newsSentiment","investmentThesis","catalystsForGrowth","majorRisks","comparablePeers","suggestedTimeHorizon","entryStrategy","exitStrategy"`;

  const userPrompt = `Return ONE JSON object matching the GroqAnalysisResult interface EXACTLY.
No markdown. No extra keys. Do not omit any required fields.
Top-level keys MUST be exactly: ${requiredTopLevelKeys}
Do NOT wrap inside another object.

STOCK DATA:
Ticker: ${input.ticker}
Company: ${input.companyName}
Sector: ${input.sector} | Industry: ${input.industry}
Exchange: ${input.exchange}
Current Price: $${input.currentPrice}

TECHNICAL INDICATORS (computed locally, authoritative):
${JSON.stringify(input.technicals, null, 2)}

PRICE SUMMARY (derived from last 120 trading days):
${JSON.stringify(priceSummary, null, 2)}

PRICE HISTORY SAMPLE (last 30 trading days: date, close, volume):
${JSON.stringify(priceHistorySample, null, 2)}

FUNDAMENTAL DATA:
${JSON.stringify(input.fundamentals, null, 2)}

RECENT NEWS (last 5 articles):
${JSON.stringify(input.recentNews.slice(0, 5), null, 2)}

ANALYST RATINGS FROM FIRMS:
${JSON.stringify(input.analystRatings, null, 2)}

INSTRUCTIONS:
1. overallScore (0-100) combines technical (40%), fundamental (40%), sentiment (20%)
2. Determine analystRating based on all signals combined
3. Realistic multibagger probability (stocks rarely 5x in 1 year)
4. Target probabilities must be consistent (4x harder than 2x, longer time = higher prob)
5. technicalSummary.signals must list ALL 17 indicators with fields: {name, value (string), interpretation}
6. investmentThesis must be 150-200 words
7. Support/resistance must be actual price numbers derived from price history
8. Return ONLY the JSON object, no other text

${enumRules}

Return the complete GroqAnalysisResult JSON now:`;

  const create = async (prefer: "primary" | "fallback", prompt: string): Promise<string> => {
    const response = await client.chat.completions.create({
      model: pickGroqModel(prefer),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });
    
    // Log token usage asynchronously
    if (response.usage) {
      TokenUsageLogModel.create({
        service: "Groq",
        model: response.model,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date(),
      }).catch((err) => {
        logger.error("Failed to log token usage to database", { err });
      });
    }

    return response.choices[0]?.message?.content ?? "{}";
  };

  const tryParse = (raw: string): GroqAnalysisResult => {
    const normalized = normalizeResultShape(JSON.parse(raw));
    return groqAnalysisResultSchema.parse(normalized);
  };

  try {
    const raw1 = await create("primary", userPrompt);
    try {
      return tryParse(raw1);
    } catch (zerr: unknown) {
      // Attempt repair with the invalid JSON + validation errors (small payload, high compliance).
      const issues = zerr && typeof zerr === "object" && "issues" in (zerr as any) ? (zerr as any).issues : null;
      const repairPrompt = `You returned invalid JSON for GroqAnalysisResult.
Fix it and return ONE corrected JSON object only.

Top-level keys MUST be exactly: ${requiredTopLevelKeys}
Do NOT wrap inside another object.

ENUMS:
${enumRules}

Invalid JSON you previously returned:
${raw1}

Validation issues:
${JSON.stringify(issues)}
`;
      const rawRepair = await create("primary", repairPrompt);
      return tryParse(rawRepair);
    }
  } catch (err1: unknown) {
    logger.warn("Groq primary output invalid; attempting fallback", { err: err1, ticker: input.ticker });
    const ultraPrompt = `Return ONE JSON object matching GroqAnalysisResult EXACTLY.
No markdown. No extra keys. Do not omit fields.
Top-level keys MUST be exactly: ${requiredTopLevelKeys}
Do NOT wrap inside another object.

Ticker: ${input.ticker}
Company: ${input.companyName}
Exchange: ${input.exchange}
Current Price: $${input.currentPrice}

Technicals:
${JSON.stringify(input.technicals)}

Fundamentals:
${JSON.stringify(input.fundamentals)}

Price summary:
${JSON.stringify(priceSummary)}

${enumRules}`;

    try {
      const raw2 = await create("fallback", ultraPrompt);
      // One more repair attempt on fallback output
      try {
        return tryParse(raw2);
      } catch (zerr2: unknown) {
        const issues2 = zerr2 && typeof zerr2 === "object" && "issues" in (zerr2 as any) ? (zerr2 as any).issues : null;
        const repairPrompt2 = `Fix this JSON to match GroqAnalysisResult EXACTLY.
Return ONE corrected JSON object only.

Top-level keys MUST be exactly: ${requiredTopLevelKeys}
ENUMS:
${enumRules}

Invalid JSON:
${raw2}

Validation issues:
${JSON.stringify(issues2)}
`;
        const raw2b = await create("fallback", repairPrompt2);
        return tryParse(raw2b);
      }
    } catch (err2: unknown) {
      const e = err2 as any;
      if (e?.status === 413 || e?.code === "rate_limit_exceeded") {
        throw new AppError("Groq rate limit / request too large", {
          statusCode: 429,
          code: "GROQ_RATE_LIMIT",
          details: e,
        });
      }
      throw err2;
    }
  }
}

