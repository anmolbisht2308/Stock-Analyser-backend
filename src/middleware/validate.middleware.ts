import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/AppError";

export function validate<T extends ZodSchema>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });
    if (!parsed.success) {
      return next(
        new AppError("Validation failed", {
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        }),
      );
    }
    next();
  };
}

