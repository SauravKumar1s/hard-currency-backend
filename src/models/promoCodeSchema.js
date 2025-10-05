// models/promoCodeSchema.js
import mongoose from "mongoose";

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // e.g. SAVE10
  discount: { type: Number, required: true }, // e.g. 10 (means 10%)
  isActive: { type: Boolean, default: true },
  expiryDate: { type: Date, required: false }, // optional
}, { timestamps: true });

export default mongoose.model("PromoCode", promoCodeSchema);
