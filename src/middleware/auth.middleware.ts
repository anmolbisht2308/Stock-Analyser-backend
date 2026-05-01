import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { AppError } from "../utils/AppError";

// Extend Express Request type to carry userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authorization header missing or malformed", { statusCode: 401, code: "MISSING_AUTH_HEADER" });
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token); // throws AppError on invalid
  req.userId = payload.userId;
  next();
}
