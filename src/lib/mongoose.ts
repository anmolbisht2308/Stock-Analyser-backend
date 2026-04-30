import mongoose from "mongoose";
import { logger } from "./logger";

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
  });

  logger.info("Mongo connected", { host: mongoose.connection.host, name: mongoose.connection.name });
}

