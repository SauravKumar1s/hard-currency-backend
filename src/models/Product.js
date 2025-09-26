import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    title: String,
    location: String,
    type: String,
    availability: String,
    price: Number,
    image: [String],
    beds: Number,
    baths: Number,
    sqft: Number,
    amenities: [String],
    videoUrl: { type: String, default: "" } // <-- add this
  },
  { timestamps: true }
);

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
