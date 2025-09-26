import mongoose from "mongoose";

const longVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    coverUrls: { type: [String], default: [] }, // multiple images
    publicId: { type: String, default: () => new mongoose.Types.ObjectId() }, // unique auto-generated
  },
  { timestamps: true }
);

export default mongoose.model("LongVideo", longVideoSchema);
