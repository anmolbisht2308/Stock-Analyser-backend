import mongoose, { type InferSchemaType } from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Razorpay references
    razorpayOrderId:   { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },

    // Plan details
    plan:         { type: String, enum: ["pro", "institutional"], required: true },
    billingCycle: { type: String, enum: ["monthly", "annual"], required: true },
    amount:       { type: Number, required: true },   // in paise (INR smallest unit)
    currency:     { type: String, required: true, default: "INR" },

    // Status lifecycle
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },

    paidAt:   { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { minimize: false },
);

PaymentSchema.index({ userId: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;
export const PaymentModel = mongoose.model("Payment", PaymentSchema);
