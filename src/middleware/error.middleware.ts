import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
  }

  logger.error("Unhandled error", { err });
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error",
    },
  });
};

