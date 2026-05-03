import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/error.middleware";
import { apiLogger } from "./middleware/apiLogger.middleware";
import stockRoutes from "./routes/stock.routes";
import trendingRoutes from "./routes/trending.routes";
import screenerRoutes from "./routes/screener.routes";
import authRoutes from "./routes/auth.routes";
import watchlistRoutes from "./routes/watchlist.routes";
import paymentRoutes from "./routes/payment.routes";
import profileRoutes from "./routes/profile.routes";

const app = express();

app.set("trust proxy", 1);

app.use(apiLogger);
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// ── Webhook route — raw body required for Razorpay HMAC verification ───────
// Must be registered BEFORE express.json() to capture raw body
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, _res, next) => {
  // Attach raw buffer to request so the webhook handler can verify signature
  (req as any).rawBody = req.body;
  // Parse JSON manually so the controller can read req.body as object
  try {
    req.body = JSON.parse(req.body.toString());
  } catch { /* leave as buffer */ }
  next();
});

// ── Standard body parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.http({ message: message.trim() }),
    },
  }),
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/stock", stockRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/screener", screenerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/payments", paymentRoutes);

app.use(errorHandler);

export default app;
