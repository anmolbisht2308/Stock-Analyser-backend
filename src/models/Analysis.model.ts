import mongoose, { type InferSchemaType } from "mongoose";

const AnalysisSchema = new mongoose.Schema(
  {
    ticker: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true, default: Date.now, index: true },
    groqModel: { type: String, required: true },
    analysisVersion: { type: String, required: true, default: "v1" },
    rawInput: { type: mongoose.Schema.Types.Mixed, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { minimize: false },
);

AnalysisSchema.index({ ticker: 1, createdAt: -1 });
// Screener query indexes
AnalysisSchema.index({ "result.overallScore": -1 });
AnalysisSchema.index({ "result.analystRating": 1 });
AnalysisSchema.index({ "rawInput.sector": 1 });
AnalysisSchema.index({ "rawInput.exchange": 1 });
AnalysisSchema.index({ "result.overallScore": -1, "result.analystRating": 1, createdAt: -1 });

export type AnalysisDoc = InferSchemaType<typeof AnalysisSchema>;
export const AnalysisModel = mongoose.model("Analysis", AnalysisSchema);

