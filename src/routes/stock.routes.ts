import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { checkQuota } from "../middleware/plan.middleware";
import { getStockAnalysis } from "../controllers/stock.controller";
import { getNews, getPriceHistory, getQuoteLive } from "../controllers/stockExtras.controller";
import { searchStocks } from "../controllers/search.controller";

const router = Router();

// Public — search and basic quotes
router.get(
  "/search",
  validate(z.object({ query: z.object({ q: z.string().min(1) }).passthrough() })),
  searchStocks,
);

router.get(
  "/:ticker/price-history",
  validate(z.object({ params: z.object({ ticker: z.string().min(1) }), query: z.object({}).passthrough() })),
  getPriceHistory,
);

router.get(
  "/:ticker/news",
  validate(z.object({ params: z.object({ ticker: z.string().min(1) }), query: z.object({ limit: z.string().optional() }).passthrough() })),
  getNews,
);

router.get(
  "/:ticker/quote",
  validate(z.object({ params: z.object({ ticker: z.string().min(1) }) })),
  getQuoteLive,
);

// 🔒 Gated: AI analysis requires auth + daily quota check
router.get(
  "/:ticker/analysis",
  requireAuth,
  checkQuota,
  validate(z.object({ params: z.object({ ticker: z.string().min(1) }) })),
  getStockAnalysis,
);

export default router;
