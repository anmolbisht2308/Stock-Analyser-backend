import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { UserModel } from "../models/User.model";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// GET /api/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.userId).select("-passwordHash").lean();
  if (!user) {
    throw new AppError("User not found", { statusCode: 404, code: "USER_NOT_FOUND" });
  }

  res.json({
    id: user._id,
    email: user.email,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    analysisCountToday: user.analysisCountToday,
    analysisCountResetAt: user.analysisCountResetAt,
    createdAt: user.createdAt,
    watchlistCount: user.watchlist?.length ?? 0,
  });
});

// PATCH /api/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { email, currentPassword, newPassword } = req.body as {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const user = await UserModel.findById(req.userId);
  if (!user) {
    throw new AppError("User not found", { statusCode: 404, code: "USER_NOT_FOUND" });
  }

  // Update email if provided
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Valid email is required", { statusCode: 400, code: "INVALID_EMAIL" });
    }
    const existing = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (existing && String(existing._id) !== req.userId) {
      throw new AppError("Email already in use", { statusCode: 409, code: "EMAIL_TAKEN" });
    }
    user.email = email.toLowerCase();
  }

  // Update password if provided
  if (newPassword) {
    if (!currentPassword) {
      throw new AppError("Current password is required to set a new password", { statusCode: 400, code: "MISSING_CURRENT_PASSWORD" });
    }
    if (newPassword.length < 8) {
      throw new AppError("New password must be at least 8 characters", { statusCode: 400, code: "INVALID_PASSWORD" });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError("Current password is incorrect", { statusCode: 401, code: "INCORRECT_PASSWORD" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  }

  await user.save();

  res.json({
    id: user._id,
    email: user.email,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    analysisCountToday: user.analysisCountToday,
    analysisCountResetAt: user.analysisCountResetAt,
    createdAt: user.createdAt,
  });
});
