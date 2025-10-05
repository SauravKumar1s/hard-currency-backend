// routes/promoCodeRoutes.js
import express from "express";
import PromoCode from "../models/promoCodeSchema.js";

const router = express.Router();

/**
 * POST /api/promocode/create
 * Admin creates a promo code
 */
router.post("/create", async (req, res) => {
  try {
    const { code, discount, expiryDate } = req.body;
    const promo = await PromoCode.create({ code, discount, expiryDate });
    res.json({ success: true, promo });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create promo code" });
  }
});

/**
 * POST /api/promocode/apply
 * User applies promo code at checkout
 */
router.post("/apply", async (req, res) => {
  try {
    const { code, totalAmount } = req.body;

    const promo = await PromoCode.findOne({ code, isActive: true });

    if (!promo) {
      return res.json({ success: false, message: "Invalid promo code" });
    }

    if (promo.expiryDate && new Date() > promo.expiryDate) {
      return res.json({ success: false, message: "Promo code expired" });
    }

    // Calculate discount
    const discountAmount = (totalAmount * promo.discount) / 100;
    const finalAmount = totalAmount - discountAmount;

    res.json({
      success: true,
      code: promo.code,
      discount: promo.discount,
      discountAmount,
      finalAmount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to apply promo code" });
  }
});

/**
 * GET /api/promocode/list
 * Admin fetches all promo codes
 */
router.get("/list", async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ success: true, promos });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch promo codes" });
  }
});

export default router;
