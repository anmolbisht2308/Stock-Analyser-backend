import type { Request, Response, NextFunction } from "express";
import { ApiLogModel } from "../models/ApiLog.model";
import { logger } from "../lib/logger";

export const apiLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime();
  
  // Log when the request finishes
  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1000 + diff[1] / 1e6;
    
    // We do not wait for the DB save to complete, to avoid blocking the response cycle
    ApiLogModel.create({
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip || req.socket.remoteAddress || "",
      userAgent: req.get("user-agent") || "",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date(),
    }).catch((err) => {
      logger.error("Failed to log API request to database", { err, url: req.url });
    });
  });

  next();
};
