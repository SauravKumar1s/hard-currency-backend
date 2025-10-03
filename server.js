import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import videoRoutes from "./src/routes/videoRoutes.js";
import productsRoutes from "./src/routes/productsAttachVideo.js";
import mediaRoutes from "./src/routes/mediaRoute.js";
import galleryRoutes from "./src/routes/galleryRoutes.js";

dotenv.config();

const app = express();

// CORS
app.use(
  cors({
    origin: "*", // allow all origins
    credentials: true
  })
);


app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));


// MongoDB
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((e) => console.error("MongoDB error:", e.message));
}

// Routes
app.use("/api/videos", videoRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/products", productsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Video server running on http://localhost:${PORT}`);
});
