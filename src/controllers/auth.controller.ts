import bcrypt from "bcryptjs";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { UserModel } from "../models/User.model";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { getRedis } from "../lib/redis";

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Valid email is required", { statusCode: 400, code: "INVALID_EMAIL" });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new AppError("Password must be at least 8 characters", { statusCode: 400, code: "INVALID_PASSWORD" });
  }

  const existing = await UserModel.findOne({ email: email.toLowerCase() }).lean();
  if (existing) {
    throw new AppError("Email already in use", { statusCode: 409, code: "EMAIL_TAKEN" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({ email: email.toLowerCase(), passwordHash });

  const accessToken = signAccessToken(String(user._id));
  const refreshToken = signRefreshToken(String(user._id));

  res.status(201).json({
    user: { id: user._id, email: user.email },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    throw new AppError("Email and password are required", { statusCode: 400, code: "MISSING_CREDENTIALS" });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new AppError("Invalid credentials", { statusCode: 401, code: "INVALID_CREDENTIALS" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid credentials", { statusCode: 401, code: "INVALID_CREDENTIALS" });
  }

  const accessToken = signAccessToken(String(user._id));
  const refreshToken = signRefreshToken(String(user._id));

  res.json({
    user: { id: user._id, email: user.email },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    throw new AppError("refreshToken is required", { statusCode: 400, code: "MISSING_REFRESH_TOKEN" });
  }

  // Check blacklist
  const redis = getRedis();
  const blacklisted = await redis.get(`rt:blacklist:${refreshToken}`);
  if (blacklisted) {
    throw new AppError("Refresh token has been revoked", { statusCode: 401, code: "REVOKED_REFRESH_TOKEN" });
  }

  const payload = verifyRefreshToken(refreshToken); // throws if invalid
  const accessToken = signAccessToken(payload.userId);

  res.json({ accessToken });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    throw new AppError("refreshToken is required", { statusCode: 400, code: "MISSING_REFRESH_TOKEN" });
  }

  // Silently verify (don't error on invalid token during logout)
  try {
    verifyRefreshToken(refreshToken);
  } catch {
    return res.json({ ok: true }); // already invalid, nothing to do
  }

  // Blacklist in Redis for remainder of 7-day TTL
  const redis = getRedis();
  await redis.set(`rt:blacklist:${refreshToken}`, "1", "EX", REFRESH_TOKEN_TTL_SECONDS);

  res.json({ ok: true });
});
