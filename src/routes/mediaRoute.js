import express from "express";
import multer from "multer";
import fs from "fs";
import cloudinary from "../utils/cloudinary.js";
import Media from "../models/mediaSchema.js";

const router = express.Router();

// Configure multer for single file storage
const upload = multer({ dest: "uploads/" });

/**
 * POST /api/videos/media
 * Upload single image and title
 */
router.post("/media", upload.single("cover"), async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: "Title is required" });
    }

    let coverUrl = null;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "longs/covers",
        resource_type: "image",
      });

      coverUrl = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      fs.unlinkSync(req.file.path); // clean temp
    }

    const media = await Media.create({ title, coverUrl });

    res.json({ success: true, media });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

/**
 * GET /api/videos/media-list
 */
router.get("/media-list", async (req, res) => {
  try {
    const mediaList = await Media.find().sort({ createdAt: -1 });
    res.json({ success: true, mediaList });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Failed to fetch media" });
  }
});

/**
 * PUT /api/videos/media/:id
 * Update title and replace image
 */
router.put("/media/:id", upload.single("cover"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    let coverUrl = media.coverUrl;

    if (req.file) {
      // delete old image
      if (coverUrl?.publicId) {
        await cloudinary.uploader.destroy(coverUrl.publicId);
      }

      // upload new
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "longs/covers",
        resource_type: "image",
      });

      coverUrl = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      fs.unlinkSync(req.file.path);
    }

    media.title = title || media.title;
    media.coverUrl = coverUrl;

    const updatedMedia = await media.save();

    res.json({ success: true, media: updatedMedia });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

/**
 * DELETE /api/videos/media/:id
 */
router.delete("/media/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const media = await Media.findByIdAndDelete(id);

    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    if (media.coverUrl?.publicId) {
      try {
        await cloudinary.uploader.destroy(media.coverUrl.publicId);
      } catch (err) {
        console.error("Failed to delete cover:", err);
      }
    }

    res.json({ success: true, message: "Media deleted successfully" });
  } catch (e) {
    console.error("Delete Error:", e);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
