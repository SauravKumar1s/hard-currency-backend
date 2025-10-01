import express from "express";
import multer from "multer";
import fs from "fs";
import cloudinary from "../utils/cloudinary.js";
import longVideoSchema from "../models/longVideoSchema.js";

const router = express.Router();

// temp // temp disk storage
const upload = multer({ dest: "uploads/" });

/**
 * POST /api/videos/upload-long
 * Upload long video with category, discount, sizes
 */
router.post("/upload-long", upload.array("cover"), async (req, res) => {
  try {
    const { title, category, description, price, discount, sizes } = req.body;

    const coverUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "longs/covers",
          resource_type: "image",
        });
        coverUrls.push({
          url: result.secure_url,
          publicId: result.public_id, // ✅ save publicId for later removal
        });
        fs.unlinkSync(file.path);
      }
    }

    let parsedSizes = [];
    if (sizes) {
      try {
        parsedSizes = JSON.parse(sizes);
      } catch {
        parsedSizes = Array.isArray(sizes) ? sizes : [sizes];
      }
    }

    const video = await longVideoSchema.create({
      title,
      description,
      category,
      price: price || 0,
      discount: discount || 0,
      sizes: parsedSizes,
      coverUrls,
    });

    res.json({ success: true, video });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

/**
 * GET /api/videos/list-long
 */
router.get("/list-long", async (req, res) => {
  try {
    const videos = await longVideoSchema.find().sort({ createdAt: -1 });
    res.json({ success: true, videos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Failed to fetch videos" });
  }
});

/**
 * PUT /api/videos/longs/:id
 * Update title, category, price, discount, sizes, covers
 */
/**
 * PUT /api/videos/longs/:id
 * Update title, category, price, discount, sizes, covers
 */
router.put("/longs/:id", upload.array("covers"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, price, discount, sizes, existingCovers } = req.body;

    let parsedSizes = [];
    try {
      parsedSizes = JSON.parse(sizes || "[]");
    } catch (err) {
      parsedSizes = Array.isArray(sizes) ? sizes : [sizes];
    }

    // Parse existingCovers - handle both string and object formats
    let parsedExistingCovers = [];
    if (existingCovers) {
      try {
        parsedExistingCovers = typeof existingCovers === 'string' 
          ? JSON.parse(existingCovers) 
          : existingCovers;
      } catch (err) {
        console.error("Error parsing existingCovers:", err);
        parsedExistingCovers = [];
      }
    }

    // Start with existing covers from frontend
    let coverUrls = [...parsedExistingCovers];

    // Add newly uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "longs/covers",
          resource_type: "image",
        });
        // Push as object to match your schema
        coverUrls.push({
          url: result.secure_url,
          publicId: result.public_id,
        });
        fs.unlinkSync(file.path);
      }
    }

    const updatedVideo = await longVideoSchema.findByIdAndUpdate(
      id,
      { 
        title, 
        description, 
        category, 
        price, 
        discount, 
        sizes: parsedSizes, 
        coverUrls 
      },
      { new: true }
    );

    if (!updatedVideo)
      return res.status(404).json({ success: false, message: "Video not found" });

    res.json({ success: true, video: updatedVideo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Update failed" });
  }
});


/**
 * DELETE /api/videos/longs/:id
 */
router.delete("/longs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const video = await longVideoSchema.findByIdAndDelete(id);

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    // delete covers from Cloudinary also
    for (const cover of video.coverUrls) {
      try {
        await cloudinary.uploader.destroy(cover.publicId);
      } catch (err) {
        console.error("Failed to delete cover:", err);
      }
    }

    res.json({ success: true, message: "Video deleted" });
  } catch (e) {
    console.error("Delete Error:", e);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
