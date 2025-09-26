import express from "express";
import multer from "multer";
import fs from "fs";
import cloudinary from "../utils/cloudinary.js";
import longVideoSchema from "../models/longVideoSchema.js";

const router = express.Router();

// temp disk storage; you can also use memoryStorage if you prefer
const upload = multer({ dest: "uploads/" });

/**
 * POST /api/videos/upload
 * Body: form-data: video=<file>
 * Returns: { success, public_id, url, duration, width, height }
 */
router.post("/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No file" });

    const { title } = req.body; // frontend se bhejna padega

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "shorts",
      context: { caption: title || "" }, // 👈 title ko context/caption me store karenge
    });

    fs.unlink(req.file.path, () => {});
    return res.json({
      success: true,
      public_id: result.public_id,
      url: result.secure_url,
      duration: result.duration,
      width: result.width,
      height: result.height,
      title: title || "",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Upload failed" });
  }
});

/**
 * POST /api/videos/cut
 * Body: { publicId, startTime, duration, aspect }
 * - aspect optional: "9:16" (default for Shorts), "1:1", "16:9"
 * Returns: { success, url }
 *
 * Note: This uses a dynamic delivery URL; Cloudinary generates it on-the-fly.
 */
router.post("/cut", async (req, res) => {
  try {
    const {
      publicId,
      startTime = 0,
      duration = 30,
      aspect = "9:16",
    } = req.body;
    if (!publicId)
      return res
        .status(400)
        .json({ success: false, error: "publicId required" });

    // Build a transformation chain:
    // 1) trim by start_offset + duration
    // 2) set aspect ratio (crop fill, auto focus)
    // 3) set a friendly resolution for Shorts (e.g., 1080x1920)
    const [arW, arH] = aspect.split(":").map(Number);
    // default to 1080 height for portrait; compute width ~ 1080 * (arW/arH)
    const targetH = 1920;
    const targetW = Math.round(targetH * (arW / arH));

    const url = cloudinary.url(publicId, {
      resource_type: "video",
      sign_url: false, // set to true if you've restricted delivery
      transformation: [
        { start_offset: startTime, duration },
        {
          crop: "fill",
          width: targetW,
          height: targetH,
          gravity: "auto",
          aspect_ratio: aspect,
        },
        // Optional: set format/mp4 + lower bitrate for faster loads
        { fetch_format: "mp4", quality: "auto" },
      ],
    });

    return res.json({ success: true, url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Cut failed" });
  }
});

/**
 * POST /api/videos/multi-cut
 * Body: { publicId, segments: [{ startTime, duration }], aspect? }
 * Returns: { success, clips: [ { url, startTime, duration } ] }
 */
router.post("/multi-cut", async (req, res) => {
  try {
    const { publicId, segments = [], aspect = "9:16" } = req.body;
    if (!publicId || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid body" });
    }

    const [arW, arH] = aspect.split(":").map(Number);
    const targetH = 1920;
    const targetW = Math.round(targetH * (arW / arH));

    const clips = segments.map(({ startTime = 0, duration = 30 }) => {
      const url = cloudinary.url(publicId, {
        resource_type: "video",
        transformation: [
          { start_offset: startTime, duration },
          {
            crop: "fill",
            width: targetW,
            height: targetH,
            gravity: "auto",
            aspect_ratio: aspect,
          },
          { fetch_format: "mp4", quality: "auto" },
        ],
      });
      return { url, startTime, duration };
    });

    return res.json({ success: true, clips });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Multi-cut failed" });
  }
});

/**
 * DELETE /api/videos/:publicId
 * Deletes the original uploaded video (NOT the on-the-fly cuts).
 */
// route
router.delete("/shorts/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;
    const result = await cloudinary.uploader.destroy(`shorts/${publicId}`, {
      resource_type: "video",
    });

    if (result.result === "ok" || result.result === "not found") {
      return res.json({ success: true, message: "Video deleted" });
    }

    return res
      .status(400)
      .json({ success: false, message: "Failed to delete video" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Delete failed" });
  }
});

router.get("/list", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      resource_type: "video",
      type: "upload",
      prefix: "shorts/",
      max_results: 20,
      context: true, // 👈 context bhi aayega
    });

    const videos = result.resources.map((v) => ({
      public_id: v.public_id,
      url: v.secure_url,
      duration: v.duration,
      title: v.context?.custom?.caption || "", // 👈 title extract
    }));

    res.json({ success: true, videos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Failed to fetch videos" });
  }
});

// Update video title
router.put("/:publicId/title", async (req, res) => {
  const { publicId } = req.params;
  const { title } = req.body;

  const video = await Video.findOneAndUpdate(
    { publicId },
    { title },
    { new: true }
  );

  if (!video)
    return res.status(404).json({ success: false, message: "Video not found" });

  res.json({ success: true, video });
});

/**
 * POST /api/videos/upload-long
 * Upload long video with category
 */

router.post("/upload-long", upload.array("cover"), async (req, res) => {
  try {
    const { title, category, description } = req.body;

    const coverUrls = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "longs/covers",
          resource_type: "image",
        });
        coverUrls.push(result.secure_url);
        fs.unlinkSync(file.path);
      }
    }

    const video = await longVideoSchema.create({
      title,
      description,
      category,
      coverUrls,
      // publicId auto-generated
    });

    res.json({ success: true, video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});




/**
 * GET /api/videos/list-long
 * List all long videos with categories
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
 * PUT /api/videos/longs/:publicId
 * Update title or category
 */
router.put("/longs/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;
    const { title, category } = req.body;

    const result = await cloudinary.uploader.explicit(`longs/${publicId}`, {
      resource_type: "video",
      type: "upload",
      context: { caption: title || "", category: category || "" },
    });

    if (!result.public_id) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    return res.json({
      success: true,
      video: {
        public_id: result.public_id,
        url: result.secure_url,
        duration: result.duration,
        title: result.context?.custom?.caption || "",
        category: result.context?.custom?.category || "",
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

/**
 * DELETE /api/videos/longs/:publicId
 * Delete long video
 */
router.delete("/longs/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;

    const result = await cloudinary.uploader.destroy(`longs/${publicId}`, {
      resource_type: "video",
    });

    if (result.result === "ok" || result.result === "not found") {
      return res.json({ success: true, message: "Video deleted" });
    }

    return res
      .status(400)
      .json({ success: false, message: "Failed to delete video" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
