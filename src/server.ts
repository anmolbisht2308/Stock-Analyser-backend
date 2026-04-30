import "dotenv/config";
import http from "node:http";
import app from "./serverApp";
import { connectMongo } from "./lib/mongoose";
import { connectRedis } from "./lib/redis";
import { logger } from "./lib/logger";

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
  logger.error("Fatal bootstrap error", { err });
  process.exit(1);
});

