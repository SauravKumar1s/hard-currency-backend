import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import paypal from "@paypal/checkout-server-sdk";
import bcrypt from "bcryptjs";

import videoRoutes from "./src/routes/videoRoutes.js";
import productsRoutes from "./src/routes/productsAttachVideo.js";
import mediaRoutes from "./src/routes/mediaRoute.js";
import galleryRoutes from "./src/routes/galleryRoutes.js";
import promoCodeRoutes from "./src/routes/promoCodeRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

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

console.log("MONGO_URI FROM ENV:", process.env.MONGO_URI);

// MongoDB
// if (process.env.MONGO_URI) {
//   mongoose
//     .connect(process.env.MONGO_URI)
//     .then(() => console.log("MongoDB connected"))
//     .catch((e) => console.error("MongoDB error:", e.message));
// }


const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB connected to:", mongoose.connection.name);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

startServer();


// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// Temporary OTP Store (better: store in DB/Redis)
let otpStore = {};

// Nodemailer setup
// Updated Nodemailer setup with better error handling
// Nodemailer setup with explicit settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  requireTLS: true,
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', {
      user: process.env.EMAIL_USER,
      passLength: process.env.EMAIL_PASS?.length,
      error: error.message
    });
  } else {
    console.log('Email server is ready to send messages');
  }
});


// 📌 Register with Email, Name, Password + Send OTP
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: "Name, email and password are required" 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: "Password must be at least 6 characters long" 
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "User already exists with this email" 
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    otpStore[email] = {
      otp,
      name,
      password: await bcrypt.hash(password, 12) // Hash password
    };

    // Send OTP email
    await transporter.sendMail({
      from: `"Hard Currency Jeans" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your Email - Hard Currency Jeans",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Hard Currency Jeans!</h2>
          <p>Hello ${name},</p>
          <p>Thank you for registering. Please use the following OTP to verify your email address:</p>
          <div style="background: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
      `,
    });

    res.json({ 
      success: true, 
      message: "OTP sent to email for verification" 
    });

  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Registration failed. Please try again." 
    });
  }
});

// 📌 Verify OTP and Complete Registration
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const storedData = otpStore[email];
    
    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP expired or invalid" 
      });
    }

    if (storedData.otp.toString() === otp.toString()) {
      // Create user in database
      const newUser = new User({
        name: storedData.name,
        email: email,
        password: storedData.password,
        isVerified: true
      });

      await newUser.save();

      // Clean up OTP store
      delete otpStore[email];

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: newUser._id, 
          email: newUser.email,
          name: newUser.name 
        }, 
        process.env.JWT_SECRET || "secretkey", 
        { expiresIn: "7d" }
      );

      return res.json({ 
        success: true, 
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email
        },
        message: "Registration successful!" 
      });
    }

    res.status(400).json({ 
      success: false, 
      message: "Invalid OTP" 
    });

  } catch (error) {
    console.error("OTP verification error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Verification failed. Please try again." 
    });
  }
});

// 📌 Login with Email and Password
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: "Email and password are required" 
    });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: "Please verify your email first" 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        name: user.name 
      }, 
      process.env.JWT_SECRET || "secretkey", 
      { expiresIn: "7d" }
    );

    res.json({ 
      success: true, 
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      message: "Login successful!" 
    });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Login failed. Please try again." 
    });
  }
});

// 📌 Forgot Password - Send OTP
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: "Email is required" 
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: "No account found with this email" 
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = { otp, type: 'password_reset' };

    await transporter.sendMail({
      from: `"Hard Currency Jeans" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP - Hard Currency Jeans",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>You requested to reset your password. Use the following OTP:</p>
          <div style="background: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    res.json({ 
      success: true, 
      message: "OTP sent to email for password reset" 
    });

  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process request" 
    });
  }
});

// 📌 Reset Password with OTP
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: "Email, OTP and new password are required" 
    });
  }

  try {
    const storedData = otpStore[email];
    
    if (!storedData || storedData.type !== 'password_reset') {
      return res.status(400).json({ 
        success: false, 
        message: "OTP expired or invalid" 
      });
    }

    if (storedData.otp.toString() === otp.toString()) {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Update password
      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      // Clean up OTP store
      delete otpStore[email];

      res.json({ 
        success: true, 
        message: "Password reset successfully" 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: "Invalid OTP" 
      });
    }

  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Password reset failed" 
    });
  }
});

// Middleware to protect routes
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Access token required" 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || "secretkey", (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }
    req.user = user;
    next();
  });
};

// Protected route example
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// Routes
app.use('/api/orders', orderRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/promo", promoCodeRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});