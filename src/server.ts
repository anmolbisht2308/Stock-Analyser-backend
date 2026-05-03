import "dotenv/config";
import http from "node:http";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
import app from "./serverApp";
import { connectMongo } from "./lib/mongoose";
import { connectRedis } from "./lib/redis";
import { logger } from "./lib/logger";
import { startTrendingWorker } from "./jobs/trendingQueue";

const port = Number(process.env.PORT ?? 5000);

async function bootstrap(): Promise<void> {
  await connectMongo();
  await connectRedis();

  // BullMQ workers disabled as requested
  // startTrendingWorker();

  const server = http.createServer(app);
  server.listen(port, () => {
    logger.info("API server listening", { port });
  });
}

bootstrap().catch((err: unknown) => {
  console.error("Fatal bootstrap error:", err); // Added console.error for Render logs
  logger.error("Fatal bootstrap error", { err });
  process.exit(1);
});
