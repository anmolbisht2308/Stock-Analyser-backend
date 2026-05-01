import mongoose, { type InferSchemaType } from "mongoose";

const ApiLogSchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    url: { type: String, required: true },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    environment: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
  },
  { minimize: false }
);

export type ApiLogDoc = InferSchemaType<typeof ApiLogSchema>;
export const ApiLogModel = mongoose.model("ApiLog", ApiLogSchema);
