import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.middleware";
import { getStockAnalysis } from "../controllers/stock.controller";
import { getNews, getPriceHistory, getQuoteLive } from "../controllers/stockExtras.controller";
import { searchStocks } from "../controllers/search.controller";

const router = Router();

router.get(
  "/search",
  validate(z.object({ query: z.object({ q: z.string().min(1) }).passthrough() })),
  searchStocks,
);

router.get(
  "/:ticker/analysis",
  validate(z.object({ params: z.object({ ticker: z.string().min(1) }) })),
  getStockAnalysis,
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

export default router;

