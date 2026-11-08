const express = require("express");
const mongoose = require("mongoose");
const Coffee = require("../models/coffee");
const Order = require("../models/order");
const { adminOnly } = require("../middleware/adminOnly1");

const router = express.Router();
const bad = (res, message) => res.status(400).json({ message });

const PAY_METHODS = ["pickup", "momo", "airtel"];
const MAX_ORDERS_PER_PHONE = 3;          // per 10 minutes, so one number cannot flood the cafe
const PHONE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TOTAL_QUANTITY = 40;           // all items together

// Customer places an order
router.post("/", async (req, res) => {
  try {
    const { name, phone, note, items, paymentMethod } = req.body;

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60)
      return bad(res, "Please enter your name");

    // "+250 788 123 456" and "+250788123456" are the same number, so we remove the spaces first
    const cleanPhone = typeof phone === "string" ? phone.trim().replace(/\s+/g, "") : "";
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone))
      return bad(res, "Please enter a valid phone number");

    if (note !== undefined && (typeof note !== "string" || note.length > 200))
      return bad(res, "Note is too long");

    const method = paymentMethod === undefined ? "pickup" : paymentMethod;
    if (!PAY_METHODS.includes(method))
      return bad(res, "Invalid payment choice");

    if (!Array.isArray(items) || items.length < 1 || items.length > 20)
      return bad(res, "Your cart is empty");

    const ids = [];
    let totalQuantity = 0;
    for (const item of items) {
      if (typeof item !== "object" || item === null || typeof item.id !== "string" ||
          !mongoose.isValidObjectId(item.id) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)
        return bad(res, "Invalid item in cart");
      ids.push(item.id);
      totalQuantity += item.quantity;
    }
    if (new Set(ids).size !== ids.length) return bad(res, "Duplicate items in cart");
    if (totalQuantity > MAX_TOTAL_QUANTITY) return bad(res, "Too many items in one order");

    // Spam guard: the same phone number can only place a few orders in a short time
    const recent = await Order.countDocuments({
      phone: cleanPhone,
      createdAt: { $gte: new Date(Date.now() - PHONE_WINDOW_MS) },
    });
    if (recent >= MAX_ORDERS_PER_PHONE)
      return res.status(429).json({ message: "Too many orders from this number. Please wait a few minutes." });

    // IMPORTANT: prices and costs come from the database, never from the browser
    const coffees = await Coffee.find({ _id: { $in: ids } });
    if (coffees.length !== ids.length) return bad(res, "An item is no longer available");

    const lines = items.map((item) => {
      const coffee = coffees.find((c) => c.id === item.id);
      return {
        coffee: coffee._id,
        name: coffee.name,
        price: coffee.price,
        costPrice: coffee.costPrice, // copied now, so later menu changes can't rewrite old profit
        quantity: item.quantity,
      };
    });
    const total = Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100;

    const order = await Order.create({
      customerName: name, phone: cleanPhone, note: note || "", paymentMethod: method, items: lines, total,
    });
    res.status(201).json({ orderId: order.id, total: order.total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Cafe staff see the latest orders (needs the admin login)
router.get("/", adminOnly, async (req, res) => {
  try {
    res.json(await Order.find().sort({ createdAt: -1 }).limit(100));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;