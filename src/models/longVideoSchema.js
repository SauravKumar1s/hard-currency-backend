import mongoose from "mongoose";

const longVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
     coverUrls: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    }
  }],

    price: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    sizes: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("LongVideo", longVideoSchema);
