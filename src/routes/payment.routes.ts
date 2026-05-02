import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getPlans,
  getMyPlan,
  createOrder,
  verifyPayment,
  handleWebhook,
} from "../controllers/payment.controller";

const router = Router();

// Public
router.get("/plans", getPlans);

// Authenticated
router.get("/my-plan", requireAuth, getMyPlan);
router.post("/create-order", requireAuth, createOrder);
router.post("/verify", requireAuth, verifyPayment);

// Webhook — raw body parsing done in serverApp.ts for this route
router.post("/webhook", handleWebhook);

export default router;
