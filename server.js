import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import paypal from "@paypal/checkout-server-sdk";

import videoRoutes from "./src/routes/videoRoutes.js";
import productsRoutes from "./src/routes/productsAttachVideo.js";
import mediaRoutes from "./src/routes/mediaRoute.js";
import galleryRoutes from "./src/routes/galleryRoutes.js";
import promoCodeRoutes from "./src/routes/promoCodeRoutes.js";
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

// MongoDB
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((e) => console.error("MongoDB error:", e.message));
}



// MongoDB
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((e) => console.error("MongoDB error:", e.message));
}

// Temporary OTP Store (better: store in DB/Redis)
let otpStore = {};

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // set in .env
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// 📌 Send OTP
app.post("/api/auth/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ success: false, message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
  otpStore[email] = otp;

  try {
    await transporter.sendMail({
      from: `"Hard Currency Jeans" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your Email",
      text: `Your OTP is ${otp}`,
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    console.error("Mail error:", error.message);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

// 📌 Verify OTP
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email].toString() === otp.toString()) {
    delete otpStore[email];

    const token = jwt.sign({ email }, process.env.JWT_SECRET || "secretkey", {
      expiresIn: "7d",
    });

    return res.json({ success: true, token });
  }

  res.status(400).json({ success: false, message: "Invalid OTP" });
});



// PayPal environment setup
let paypalEnvironment;
let paypalClient;

if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    paypalEnvironment = new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
  } else {
    paypalEnvironment = new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
  }
  paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);
  console.log('PayPal SDK initialized');
}

// PayPal Routes
app.post('/api/create-paypal-order', async (req, res) => {
  try {
    const { cartTotal, items, currency = 'USD' } = req.body;
    
    if (!paypalClient) {
      return res.status(500).json({ error: 'PayPal not configured' });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: cartTotal.toString(),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: cartTotal.toString()
            }
          }
        },
        items: items.map(item => ({
          name: item.name || 'Product',
          description: item.description || '',
          unit_amount: {
            currency_code: currency,
            value: item.price.toString()
          },
          quantity: item.quantity.toString(),
          sku: item.id ? item.id.toString() : 'SKU001'
        }))
      }],
      application_context: {
        brand_name: 'Hard Currency Jeans',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success.html`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel.html`
      }
    });

    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (error) {
    console.error('PayPal order error:', error);
    res.status(500).json({ error: 'Failed to create PayPal order', details: error.message });
  }
});

app.post('/api/capture-paypal-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    
    if (!paypalClient) {
      return res.status(500).json({ error: 'PayPal not configured' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    
    // Here you can save the order to your database
    console.log('Order captured:', capture.result);
    
    res.json({ 
      success: true, 
      orderID: capture.result.id,
      status: capture.result.status,
      captureData: capture.result
    });
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ error: 'Failed to capture PayPal order', details: error.message });
  }
});

// Process regular orders (Cash on Delivery/Card)
app.post('/api/process-order', async (req, res) => {
  try {
    const { orderData, paymentMethod } = req.body;
    
    // Here you would save the order to your database
    console.log('Order received:', { orderData, paymentMethod });
    
    // Generate order ID
    const orderId = 'ORD_' + Date.now();
    
    // Simulate order processing
    res.json({ 
      success: true, 
      orderId: orderId,
      message: 'Order placed successfully',
      paymentMethod: paymentMethod,
      total: orderData.total
    });
  } catch (error) {
    console.error('Order processing error:', error);
    res.status(500).json({ error: 'Failed to process order', details: error.message });
  }
});

// Get PayPal client ID for frontend
app.get('/api/paypal-client-id', (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID) {
    return res.status(500).json({ error: 'PayPal client ID not configured' });
  }
  
  res.json({ 
    clientId: process.env.PAYPAL_CLIENT_ID,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  });
});

// Routes
app.use("/api/videos", videoRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/promo", promoCodeRoutes );


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});