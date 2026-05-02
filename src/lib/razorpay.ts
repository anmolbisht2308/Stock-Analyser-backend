import Razorpay from "razorpay";
import crypto from "crypto";

// ── Singleton Razorpay client ──────────────────────────────────────────────
export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ── Plan config (single source of truth — server side only) ───────────────
export type PlanId       = "pro" | "institutional";
export type BillingCycle = "monthly" | "annual";

export interface PlanConfig {
  id:           PlanId;
  label:        string;
  description:  string;
  monthly:      { amount: number; label: string }; // amount in paise
  annual:       { amount: number; label: string };
  dailyLimit:   number;
  watchlistMax: number;
  features:     string[];
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  pro: {
    id:          "pro",
    label:       "Pro",
    description: "For serious retail investors",
    monthly:     { amount: 49900,  label: "₹499/month" },
    annual:      { amount: 399900, label: "₹3,999/year" },
    dailyLimit:  50,
    watchlistMax: 50,
    features: [
      "50 AI analyses per day",
      "Full Screener — all filters & pages",
      "Watchlist up to 50 stocks with live quotes",
      "30-day analysis history per ticker",
      "Priority cache refresh",
    ],
  },
  institutional: {
    id:          "institutional",
    label:       "Institutional",
    description: "For HNIs, traders & fund managers",
    monthly:     { amount: 299900,  label: "₹2,999/month" },
    annual:      { amount: 2499900, label: "₹24,999/year" },
    dailyLimit:  500,
    watchlistMax: 500,
    features: [
      "500 AI analyses per day (effectively unlimited)",
      "Advanced Screener + custom sort fields",
      "Unlimited Watchlist",
      "REST API key access",
      "Bulk analysis (10 tickers at once)",
      "Multibagger score alerts",
      "Priority support",
    ],
  },
};

export const DAILY_LIMITS: Record<"free" | PlanId, number> = {
  free:          3,
  pro:           50,
  institutional: 500,
};

// Plan duration in milliseconds
export const PLAN_DURATION_MS: Record<BillingCycle, number> = {
  monthly: 30  * 24 * 60 * 60 * 1000,
  annual:  365 * 24 * 60 * 60 * 1000,
};

// ── HMAC helpers ──────────────────────────────────────────────────────────

/** Verify client-side payment callback signature */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const body    = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Verify Razorpay webhook signature (uses raw body) */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false; // webhook secret not configured — fail closed
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
