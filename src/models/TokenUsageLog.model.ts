import mongoose, { type InferSchemaType } from "mongoose";

const TokenUsageLogSchema = new mongoose.Schema(
  {
    service: { type: String, required: true, index: true },
    model: { type: String, required: true },
    promptTokens: { type: Number, required: true, default: 0 },
    completionTokens: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    environment: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
  },
  { minimize: false }
);

export type TokenUsageLogDoc = InferSchemaType<typeof TokenUsageLogSchema>;
export const TokenUsageLogModel = mongoose.model("TokenUsageLog", TokenUsageLogSchema);
