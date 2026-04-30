import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/error.middleware";
import stockRoutes from "./routes/stock.routes";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
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

app.use(errorHandler);

export default app;

