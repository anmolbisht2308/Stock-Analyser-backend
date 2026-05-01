import mongoose, { type InferSchemaType } from "mongoose";

const TrendingTickerSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    name: { type: String, default: "" },
    price: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    changePercent: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    marketCap: { type: Number, default: 0 },
  },
  { _id: false },
);

const TrendingSnapshotSchema = new mongoose.Schema(
  {
    market: { type: String, required: true, index: true },
    fetchedAt: { type: Date, required: true, default: Date.now, index: true },
    tickers: { type: [TrendingTickerSchema], required: true },
  },
  { minimize: false },
);

// Keep only last 48 snapshots per market (2 days at hourly cadence)
TrendingSnapshotSchema.index({ market: 1, fetchedAt: -1 });

export type TrendingSnapshotDoc = InferSchemaType<typeof TrendingSnapshotSchema>;
export const TrendingSnapshotModel = mongoose.model("TrendingSnapshot", TrendingSnapshotSchema);
