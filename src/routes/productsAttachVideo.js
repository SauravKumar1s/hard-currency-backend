import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

/**
 * POST /api/products/attach-video
 * Body: { propertyId, videoUrl }
 */
router.post("/attach-video", async (req, res) => {
  try {
    const { propertyId, videoUrl } = req.body;
    if (!propertyId || !videoUrl) {
      return res.status(400).json({ success: false, error: "propertyId and videoUrl required" });
    }

    const updated = await Product.findByIdAndUpdate(
      propertyId,
      { videoUrl },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    return res.json({ success: true, property: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Attach failed" });
  }
});

export default router;
