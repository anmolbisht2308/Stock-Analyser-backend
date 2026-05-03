import "dotenv/config";
import http from "node:http";
import fs from "node:fs";

fs.writeSync(2, "SERVER STARTING UP...\n");

process.on("uncaughtException", (err) => {
  fs.writeSync(2, "UNCAUGHT EXCEPTION: " + String(err) + "\n" + (err?.stack || "") + "\n");
  setTimeout(() => process.exit(1), 2000);
});

process.on("unhandledRejection", (reason, promise) => {
  fs.writeSync(2, "UNHANDLED REJECTION: " + String(reason) + "\n");
  setTimeout(() => process.exit(1), 2000);
});

import app from "./serverApp";
import { connectMongo } from "./lib/mongoose";
import { connectRedis } from "./lib/redis";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT ?? 5000);

async function bootstrap(): Promise<void> {
  fs.writeSync(2, `BOOTSTRAP RUNNING. MONGODB_URI exists: ${!!process.env.MONGODB_URI}, REDIS_URL exists: ${!!process.env.REDIS_URL}\n`);
  
  await connectMongo();
  fs.writeSync(2, "Mongo connected successfully.\n");
  
  await connectRedis();
  fs.writeSync(2, "Redis connected successfully.\n");

  const server = http.createServer(app);
  server.listen(port, "0.0.0.0", () => {
    fs.writeSync(2, `SERVER SUCCESSFULLY LISTENING ON PORT ${port}\n`);
    logger.info("API server listening", { port });
  });
}

bootstrap().catch((err: unknown) => {
  fs.writeSync(2, "Fatal bootstrap error: " + String(err) + "\n");
  logger.error("Fatal bootstrap error", { err });
  setTimeout(() => process.exit(1), 2000);
});
