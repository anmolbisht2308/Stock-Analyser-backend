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
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { minimize: false },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const UserModel = mongoose.model("User", UserSchema);
