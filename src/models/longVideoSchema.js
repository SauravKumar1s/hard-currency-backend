import mongoose from "mongoose";

const longVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    coverUrls: [String],
    price: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }, // ✅ add discount
    sizes: [{ type: String }],              // ✅ add sizes
    publicId: { type: String },             // useful for Cloudinary
  },
  { timestamps: true }
);

export default mongoose.model("LongVideo", longVideoSchema);
