import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/User.model";
import { AppError } from "../utils/AppError";
import { DAILY_LIMITS } from "../lib/razorpay";
import { asyncHandler } from "../utils/asyncHandler";

type Plan = "free" | "pro" | "institutional";
const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, institutional: 2 };

// ── requirePlan ─────────────────────────────────────────────────────────────
// Gate a route to a minimum plan tier.
export function requirePlan(minPlan: Plan) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const user = await UserModel.findById(req.userId, { plan: 1, planExpiresAt: 1 }).lean();
    if (!user) throw new AppError("User not found", { statusCode: 401, code: "USER_NOT_FOUND" });

    // Treat expired plans as free
    const effectivePlan: Plan =
      user.plan !== "free" && user.planExpiresAt && new Date(user.planExpiresAt) < new Date()
        ? "free"
        : (user.plan as Plan);

    if (PLAN_RANK[effectivePlan] < PLAN_RANK[minPlan]) {
      throw new AppError(
        `This feature requires a ${minPlan} plan. Please upgrade.`,
        { statusCode: 403, code: "PLAN_UPGRADE_REQUIRED", details: { required: minPlan, current: effectivePlan } }
      );
    }
    next();
  });
}

// ── checkQuota ──────────────────────────────────────────────────────────────
// Enforces daily analysis quota by plan. Increments count on pass.
export const checkQuota = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.userId) {
    throw new AppError("Authentication required", { statusCode: 401, code: "MISSING_AUTH_HEADER" });
  }

  const user = await UserModel.findById(req.userId, {
    plan: 1, planExpiresAt: 1,
    analysisCountToday: 1, analysisCountResetAt: 1,
  });
  if (!user) throw new AppError("User not found", { statusCode: 401, code: "USER_NOT_FOUND" });

  // Resolve effective plan (expire check)
  const effectivePlan: Plan =
    user.plan !== "free" && user.planExpiresAt && new Date(user.planExpiresAt) < new Date()
      ? "free"
      : (user.plan as Plan);

  const limit = DAILY_LIMITS[effectivePlan];

  // Reset counter if it's a new calendar day
  const now = new Date();
  const resetAt = user.analysisCountResetAt ? new Date(user.analysisCountResetAt) : new Date(0);
  if (
    now.getUTCDate() !== resetAt.getUTCDate() ||
    now.getUTCMonth() !== resetAt.getUTCMonth() ||
    now.getUTCFullYear() !== resetAt.getUTCFullYear()
  ) {
    user.analysisCountToday = 0;
    user.analysisCountResetAt = now;
  }

  if (user.analysisCountToday >= limit) {
    throw new AppError(
      `Daily analysis limit of ${limit} reached for your ${effectivePlan} plan. Upgrade to get more.`,
      {
        statusCode: 402,
        code: "QUOTA_EXCEEDED",
        details: { plan: effectivePlan, limit, used: user.analysisCountToday },
      }
    );
  }

  // Increment and save (fire-and-forget for speed)
  user.analysisCountToday += 1;
  user.save().catch(() => {}); // non-blocking

  next();
});
