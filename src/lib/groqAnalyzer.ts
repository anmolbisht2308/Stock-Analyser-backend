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
    supportLevels: z.array(z.number().nonnegative()),
    resistanceLevels: z.array(z.number().nonnegative()),
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
  let x = n;
  if (typeof x === "string") {
    x = x.replace(/%/g, "").trim();
    x = Number(x);
  }
  if (typeof x !== "number" || Number.isNaN(x) || !Number.isFinite(x)) return 0;
  
  // If the LLM returned a decimal like 0.73 instead of 73
  if (x > 0 && x <= 1 && !Number.isInteger(x)) {
    x = x * 100;
  }
  
  return Math.round(Math.max(0, Math.min(100, x as number)));
}

function clampMinus100to100(n: unknown): number {
  let x = n;
  if (typeof x === "string") {
    x = x.replace(/%/g, "").trim();
    x = Number(x);
  }
  if (typeof x !== "number" || Number.isNaN(x) || !Number.isFinite(x)) return 0;
  
  if (x > -1 && x < 1 && x !== 0 && !Number.isInteger(x)) {
    x = x * 100;
  }
  
  return Math.round(Math.max(-100, Math.min(100, x as number)));
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const found = allowed.find((a) => a === raw);
  return found ?? fallback;
}

function normalizeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeStringArray(value: unknown): string[] {
  return normalizeArray(value).map(String).filter(s => s.trim().length > 0);
}

function normalizeNumberArray(value: unknown): number[] {
  return normalizeArray(value).map(Number).filter(n => !Number.isNaN(n));
}

function parseMoney(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

function normalizeResultShape(rawObj: unknown): unknown {
  if (!rawObj || typeof rawObj !== "object") return rawObj;
  const obj: any = rawObj;

  obj.analystRating = normalizeEnum(obj.analystRating, ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"] as const, "HOLD");
  obj.overallScore = clamp01to100(obj.overallScore);

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
    obj.multibaggerProbability.reasoning = obj.multibaggerProbability.reasoning || "No reasoning provided by analysis model.";
  }

  if (!obj?.targetProbabilities) {
    obj.targetProbabilities = {};
  }
  for (const k of ["twoX", "threeX", "fourX"] as const) {
    const fallbackKey = k === "twoX" ? "2x" : k === "threeX" ? "3x" : "4x";
    
    // Attempt to find the object under standard or fallback key
    let block = obj.targetProbabilities[k] || obj.targetProbabilities[fallbackKey];
    
    if (!block || typeof block !== "object") {
      block = { within1Y: 0, within2Y: 0, within3Y: 0 };
    }
    
    // Also handle possible LLM key variations like "1Y", "1y", "within1Year"
    const w1y = block.within1Y ?? block["1Y"] ?? block["1y"] ?? block.within1Year ?? 0;
    const w2y = block.within2Y ?? block["2Y"] ?? block["2y"] ?? block.within2Years ?? 0;
    const w3y = block.within3Y ?? block["3Y"] ?? block["3y"] ?? block.within3Years ?? 0;

    obj.targetProbabilities[k] = {
      within1Y: clamp01to100(w1y),
      within2Y: clamp01to100(w2y),
      within3Y: clamp01to100(w3y),
    };
  }

  if (!obj?.targetPrices) {
    obj.targetPrices = {};
  }
  obj.targetPrices.conservative = parseMoney(obj.targetPrices.conservative);
  obj.targetPrices.base = parseMoney(obj.targetPrices.base);
  obj.targetPrices.optimistic = parseMoney(obj.targetPrices.optimistic);
  obj.targetPrices.timeHorizon = obj.targetPrices.timeHorizon || "1-3 years";

  if (obj?.newsSentiment) {
    obj.newsSentiment.overall = normalizeEnum(
      obj.newsSentiment.overall,
      ["VERY POSITIVE", "POSITIVE", "NEUTRAL", "NEGATIVE", "VERY NEGATIVE"] as const,
      "NEUTRAL",
    );
    obj.newsSentiment.sentimentScore = clampMinus100to100(obj.newsSentiment.sentimentScore);
  }

  if (obj?.technicalSummary) {
    obj.technicalSummary.trend = normalizeEnum(
      obj.technicalSummary.trend,
      ["STRONG UPTREND", "UPTREND", "SIDEWAYS", "DOWNTREND", "STRONG DOWNTREND"] as const,
      "SIDEWAYS",
    );
    obj.technicalSummary.momentum = normalizeEnum(obj.technicalSummary.momentum, ["BULLISH", "NEUTRAL", "BEARISH"] as const, "NEUTRAL");
    obj.technicalSummary.technicalScore = clamp01to100(obj.technicalSummary.technicalScore);
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
    obj.fundamentalSummary.fundamentalScore = clamp01to100(obj.fundamentalSummary.fundamentalScore);
    obj.fundamentalSummary.keyStrengths = normalizeStringArray(obj.fundamentalSummary.keyStrengths);
    obj.fundamentalSummary.keyRisks = normalizeStringArray(obj.fundamentalSummary.keyRisks);
  }

  if (obj?.newsSentiment) {
    obj.newsSentiment.catalysts = normalizeStringArray(obj.newsSentiment.catalysts);
    obj.newsSentiment.risks = normalizeStringArray(obj.newsSentiment.risks);
  }

  if (obj?.technicalSummary) {
    obj.technicalSummary.supportLevels = normalizeNumberArray(obj.technicalSummary.supportLevels);
    obj.technicalSummary.resistanceLevels = normalizeNumberArray(obj.technicalSummary.resistanceLevels);
    obj.technicalSummary.keyPatterns = normalizeStringArray(obj.technicalSummary.keyPatterns);
  }

  obj.catalystsForGrowth = normalizeStringArray(obj.catalystsForGrowth);
  obj.majorRisks = normalizeStringArray(obj.majorRisks);
  obj.comparablePeers = normalizeStringArray(obj.comparablePeers);

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
    priceHistorySample: input.priceHistory.slice(-10),
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

const schemaStructure = `
{
  "overallScore": <integer 0-100>,
  "analystRating": <enum>,
  "ratingReason": <string max 50 words>,
  "multibaggerProbability": {
    "within1Year": <integer 0-100>, "within2Years": <integer 0-100>, "within3Years": <integer 0-100>,
    "confidence": <enum>, "reasoning": <string max 50 words>
  },
  "targetProbabilities": {
    "twoX": { "within1Y": <integer 0-100>, "within2Y": <integer 0-100>, "within3Y": <integer 0-100> },
    "threeX": { "within1Y": <integer 0-100>, "within2Y": <integer 0-100>, "within3Y": <integer 0-100> },
    "fourX": { "within1Y": <integer 0-100>, "within2Y": <integer 0-100>, "within3Y": <integer 0-100> }
  },
  "targetPrices": {
    "conservative": <number>, "base": <number>, "optimistic": <number>, "timeHorizon": <string>
  },
  "technicalSummary": {
    "trend": <enum>, "momentum": <enum>, "supportLevels": [<number>, ...], "resistanceLevels": [<number>, ...],
    "keyPatterns": [<string>, ...], "technicalScore": <integer 0-100>,
    "signals": [ { "name": <string>, "value": <string>, "interpretation": <enum> }, ... ]
  },
  "fundamentalSummary": {
    "valuationStatus": <enum>, "growthOutlook": <enum>, "financialHealth": <enum>,
    "fundamentalScore": <integer 0-100>, "keyStrengths": [<string>, ...], "keyRisks": [<string>, ...]
  },
  "newsSentiment": {
    "overall": <enum>, "sentimentScore": <integer -100 to 100>,
    "catalysts": [<string>, ...], "risks": [<string>, ...]
  },
  "investmentThesis": <string max 50 words>,
  "catalystsForGrowth": [<string>, ...],
  "majorRisks": [<string>, ...],
  "comparablePeers": [<string>, ...],
  "suggestedTimeHorizon": <string>,
  "entryStrategy": <string>,
  "exitStrategy": <string>
}
`;

  const userPrompt = `Return ONE JSON object matching the GroqAnalysisResult interface EXACTLY.
No markdown. No extra keys. Do not omit any required fields.
Top-level keys MUST be exactly: ${requiredTopLevelKeys}
Do NOT wrap inside another object.

EXPECTED JSON STRUCTURE:
${schemaStructure}

STOCK DATA:
Ticker: ${input.ticker}
Company: ${input.companyName}
Sector: ${input.sector} | Industry: ${input.industry}
Exchange: ${input.exchange}
Current Price: $${input.currentPrice}

TECHNICAL INDICATORS (computed locally, authoritative):
${JSON.stringify(input.technicals)}

PRICE SUMMARY (derived from last 120 trading days):
${JSON.stringify(priceSummary)}

PRICE HISTORY SAMPLE (last 10 trading days: date, close, volume):
${JSON.stringify(priceHistorySample)}

FUNDAMENTAL DATA:
${JSON.stringify(input.fundamentals)}

RECENT NEWS (last 3 articles):
${JSON.stringify(input.recentNews.slice(0, 3))}

ANALYST RATINGS FROM FIRMS:
${JSON.stringify(input.analystRatings)}

INSTRUCTIONS:
1. overallScore (INTEGER 0-100) combines technical (40%), fundamental (40%), sentiment (20%)
2. Determine analystRating based on all signals combined
3. Realistic multibagger probability (INTEGER 0-100). Use EXACT keys: "within1Year", "within2Years", "within3Years"
4. Target probabilities must be INTEGERS 0-100. Use EXACT keys: "twoX", "threeX", "fourX". Inside them, use EXACT keys: "within1Y", "within2Y", "within3Y".
5. technicalSummary.signals must list ALL 17 indicators with fields: {name, value (string), interpretation}
6. Keep ALL text fields (investmentThesis, reasoning) CONCISE: Max 50 words.
7. Support/resistance must be actual price numbers derived from price history
8. Arrays (keyStrengths, majorRisks, etc.) max 3 items each.
9. Return ONLY the JSON object, no other text

${enumRules}

Return the complete GroqAnalysisResult JSON now:`;

  const create = async (prefer: "primary" | "fallback", purpose: string, prompt: string, notes: string = ""): Promise<string> => {
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
        purpose,
        ticker: input.ticker,
        notes,
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
    try {
      const normalized = normalizeResultShape(JSON.parse(raw));
      return groqAnalysisResultSchema.parse(normalized);
    } catch (e: any) {
      console.error("[Groq] tryParse failed!", e?.issues || e?.message || e);
      throw e;
    }
  };

  try {
    const raw1 = await create("primary", "initial_analysis", userPrompt);
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
      const rawRepair = await create("primary", "repair_validation_primary", repairPrompt, String(zerr));
      return tryParse(rawRepair);
    }
  } catch (err1: unknown) {
    logger.warn("Groq primary output invalid; attempting fallback", { err: err1, ticker: input.ticker });
    const ultraPrompt = `Return ONE JSON object matching GroqAnalysisResult EXACTLY.
No markdown. No extra keys. Do not omit fields.
Top-level keys MUST be exactly: ${requiredTopLevelKeys}
Do NOT wrap inside another object.

EXPECTED JSON STRUCTURE:
${schemaStructure}

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
      const raw2 = await create("fallback", "fallback_analysis", ultraPrompt, String(err1));
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
        const raw2b = await create("fallback", "repair_validation_fallback", repairPrompt2, String(zerr2));
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

