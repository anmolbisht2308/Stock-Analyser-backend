import "dotenv/config";
import http from "node:http";
import app from "./serverApp";
import { connectMongo } from "./lib/mongoose";
import { connectRedis } from "./lib/redis";
import { logger } from "./lib/logger";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION: ", err);
  logger.error("UNCAUGHT EXCEPTION", { err });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION: ", reason);
  logger.error("UNHANDLED REJECTION", { reason });
});

const port = Number(process.env.PORT ?? 5000);

async function bootstrap(): Promise<void> {
  await connectMongo();
  await connectRedis();

  const server = http.createServer(app);
  server.listen(port, () => {
    logger.info("API server listening", { port });
  });
}

bootstrap().catch((err: unknown) => {
  console.error("FATAL ERROR: ", err); // Instant sync print
  logger.error("Fatal bootstrap error", { err });
});
