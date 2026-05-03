import "dotenv/config";
import http from "node:http";

process.on("uncaughtException", (err) => {
  process.stderr.write("UNCAUGHT EXCEPTION: " + String(err) + "\n" + (err?.stack || "") + "\n");
});

process.on("unhandledRejection", (reason, promise) => {
  process.stderr.write("UNHANDLED REJECTION: " + String(reason) + "\n");
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
  process.stderr.write("Fatal bootstrap error: " + String(err) + "\n");
  logger.error("Fatal bootstrap error", { err });
});
