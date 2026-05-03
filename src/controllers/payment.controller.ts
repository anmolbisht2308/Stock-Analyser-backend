import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { razorpay, verifyPaymentSignature, verifyWebhookSignature, PLAN_CONFIGS, PLAN_DURATION_MS, type PlanId, type BillingCycle } from "../lib/razorpay";
import { UserModel } from "../models/User.model";
import { PaymentModel } from "../models/Payment.model";
import { logger } from "../lib/logger";

// ── GET /api/payments/plans ─────────────────────────────────────────────────
// Public: returns plan metadata for the pricing page
export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  const plans = Object.values(PLAN_CONFIGS).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    monthly: p.monthly,
    annual: p.annual,
    dailyLimit: p.dailyLimit,
    watchlistMax: p.watchlistMax,
    features: p.features,
  }));
  res.json({ plans, keyId: process.env.RAZORPAY_KEY_ID });
});

// ── GET /api/payments/my-plan ───────────────────────────────────────────────
// Auth required: returns current user plan + quota status
export const getMyPlan = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.userId, {
    plan: 1, planExpiresAt: 1,
    analysisCountToday: 1, analysisCountResetAt: 1,
  }).lean();

  if (!user) throw new AppError("User not found", { statusCode: 404, code: "USER_NOT_FOUND" });

  const now = new Date();
  const isExpired = user.plan !== "free" && user.planExpiresAt && new Date(user.planExpiresAt) < now;
  const effectivePlan = isExpired ? "free" : user.plan;

  res.json({
    plan: effectivePlan,
    planExpiresAt: user.planExpiresAt,
    isExpired: !!isExpired,
    analysisCountToday: user.analysisCountToday ?? 0,
    analysisCountResetAt: user.analysisCountResetAt,
  });
});

// ── POST /api/payments/create-order ────────────────────────────────────────
// Auth required: creates a Razorpay order for the selected plan
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { plan, billingCycle } = req.body as { plan?: PlanId; billingCycle?: BillingCycle };

  if (!plan || !PLAN_CONFIGS[plan]) {
    throw new AppError("Invalid plan selected", { statusCode: 400, code: "INVALID_PLAN" });
  }
  if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
    throw new AppError("billingCycle must be 'monthly' or 'annual'", { statusCode: 400, code: "INVALID_BILLING_CYCLE" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  logger.debug(`createOrder: plan=${plan} billingCycle=${billingCycle} keyId=${keyId ? "SET" : "MISSING"} keySecret=${keySecret ? "SET" : "MISSING"}`);

  if (!keyId || !keySecret) {
    throw new AppError("Payment gateway not configured", { statusCode: 503, code: "PAYMENT_GATEWAY_UNAVAILABLE" });
  }

  const planConfig = PLAN_CONFIGS[plan];
  const amount = planConfig[billingCycle].amount; // in paise

  // Create Razorpay order
  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${String(req.userId).slice(-8)}${Date.now().toString().slice(-6)}`,
      notes: {
        userId: String(req.userId),
        plan,
        billingCycle,
      },
    });

    // Persist pending payment record
    await PaymentModel.create({
      userId: req.userId,
      razorpayOrderId: order.id,
      plan,
      billingCycle,
      amount,
      currency: "INR",
      status: "created",
      metadata: { receipt: order.receipt },
    });

    logger.debug(`createOrder success: orderId=${order.id} userId=${req.userId}`);

    res.status(201).json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      billingCycle,
      planLabel: planConfig[billingCycle].label,
    });
  } catch (error: any) {
    const razorpayError = error.error?.description || error.message || "Unknown Razorpay error";
    const statusCode = error.statusCode ?? error.error?.code ?? 500;
    logger.error(`createOrder Razorpay error: ${razorpayError} | statusCode=${statusCode} | raw=${JSON.stringify(error.error ?? {})}`);
    throw new AppError(
      `Failed to create payment: ${razorpayError}`,
      { statusCode: typeof statusCode === "number" ? statusCode : 500, code: "RAZORPAY_ORDER_FAILED" },
    );
  }
});

// ── POST /api/payments/verify ───────────────────────────────────────────────
// Auth required: called client-side after Razorpay modal success
// Verifies HMAC signature and upgrades user plan
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body as Record<string, string>;

  if (!orderId || !paymentId || !signature) {
    throw new AppError("Missing payment verification fields", { statusCode: 400, code: "MISSING_PAYMENT_FIELDS" });
  }

  // 1. Verify HMAC signature
  const isValid = verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) {
    throw new AppError("Payment signature verification failed", { statusCode: 400, code: "INVALID_SIGNATURE" });
  }

  // 2. Find pending Payment doc — must belong to this user (prevents IDOR)
  const payment = await PaymentModel.findOne({ razorpayOrderId: orderId, userId: req.userId });
  if (!payment) {
    throw new AppError("Order not found", { statusCode: 404, code: "ORDER_NOT_FOUND" });
  }
  if (payment.status === "paid") {
    // Already processed — idempotent response
    return res.json({ ok: true, plan: payment.plan, alreadyProcessed: true });
  }

  const now = new Date();

  // 3. Update payment record
  await PaymentModel.findByIdAndUpdate(payment._id, {
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
    status: "paid",
    paidAt: now,
  });

  // 4. Upgrade user plan
  const planExpiry = new Date(now.getTime() + PLAN_DURATION_MS[payment.billingCycle as BillingCycle]);
  await UserModel.findByIdAndUpdate(req.userId, {
    plan: payment.plan,
    planExpiresAt: planExpiry,
  });

  logger.info(`Plan upgraded: userId=${req.userId} plan=${payment.plan} expires=${planExpiry.toISOString()}`);

  res.json({ ok: true, plan: payment.plan, planExpiresAt: planExpiry });
});

// ── POST /api/payments/webhook ──────────────────────────────────────────────
// Razorpay webhook — raw body required for HMAC verification
// This is the authoritative source of truth (handles server-side confirmation)
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature) {
    res.status(400).json({ error: "Missing signature header" });
    return;
  }

  // Verify webhook signature (raw Buffer body)
  const rawBody = (req as any).rawBody as Buffer;
  if (!rawBody) {
    res.status(400).json({ error: "Raw body not available" });
    return;
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn("Razorpay webhook signature mismatch");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  const event = req.body as { event: string; payload: any };
  logger.info(`Razorpay webhook: ${event.event}`);

  if (event.event === "payment.captured") {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id as string;
    const paymentId = paymentEntity?.id as string;

    if (!orderId) {
      res.status(200).json({ ok: true }); // acknowledge
      return;
    }

    const payment = await PaymentModel.findOne({ razorpayOrderId: orderId });
    if (!payment || payment.status === "paid") {
      res.status(200).json({ ok: true }); // already handled
      return;
    }

    const now = new Date();
    const planExpiry = new Date(now.getTime() + PLAN_DURATION_MS[payment.billingCycle as BillingCycle]);

    await PaymentModel.findByIdAndUpdate(payment._id, {
      razorpayPaymentId: paymentId,
      status: "paid",
      paidAt: now,
    });

    await UserModel.findByIdAndUpdate(payment.userId, {
      plan: payment.plan,
      planExpiresAt: planExpiry,
    });

    logger.info(`[Webhook] Plan upgraded: userId=${payment.userId} plan=${payment.plan}`);
  }

  if (event.event === "payment.failed") {
    const orderId = event.payload?.payment?.entity?.order_id as string;
    if (orderId) {
      await PaymentModel.findOneAndUpdate({ razorpayOrderId: orderId }, { status: "failed" });
    }
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ ok: true });
});
