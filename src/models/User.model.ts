import mongoose, { type InferSchemaType } from "mongoose";

const WatchlistItemSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    addedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    watchlist: { type: [WatchlistItemSchema], default: [] },

    // Plan / billing
    plan: { type: String, enum: ["free", "pro", "institutional"], default: "free", index: true },
    planExpiresAt: { type: Date, default: null },
    razorpayCustomerId: { type: String, default: "" },

    // Usage quota — reset every 24h
    analysisCountToday: { type: Number, default: 0 },
    analysisCountResetAt: { type: Date, default: Date.now },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { minimize: false },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const UserModel = mongoose.model("User", UserSchema);
