import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";

export type TokenPayload = { userId: string };

function ensureSecrets(): { access: string; refresh: string } {
  const access = process.env.JWT_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (!access || !refresh) throw new AppError("Missing JWT secrets", { statusCode: 500, code: "MISSING_JWT_SECRETS" });
  return { access, refresh };
}

export function signAccessToken(userId: string): string {
  const { access } = ensureSecrets();
  return jwt.sign({ userId }, access, { expiresIn: "15m" });
}

export function signRefreshToken(userId: string): string {
  const { refresh } = ensureSecrets();
  return jwt.sign({ userId }, refresh, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  const { access } = ensureSecrets();
  try {
    return jwt.verify(token, access) as TokenPayload;
  } catch {
    throw new AppError("Invalid or expired access token", { statusCode: 401, code: "INVALID_ACCESS_TOKEN" });
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  const { refresh } = ensureSecrets();
  try {
    return jwt.verify(token, refresh) as TokenPayload;
  } catch {
    throw new AppError("Invalid or expired refresh token", { statusCode: 401, code: "INVALID_REFRESH_TOKEN" });
  }
}
