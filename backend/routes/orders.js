const express = require("express");
const mongoose = require("mongoose");
const Coffee = require("../models/coffee");
const Order = require("../models/order");
const { adminOnly } = require("../middleware/adminOnly1");

const router = express.Router();
const bad = (res, message) => res.status(400).json({ message });

// Customer places an order
router.post("/", async (req, res) => {
  try {
    const { name, phone, note, items } = req.body;

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60)
      return bad(res, "Please enter your name");
    if (typeof phone !== "string" || !/^\+?[0-9 ]{7,15}$/.test(phone.trim()))
      return bad(res, "Please enter a valid phone number");
    if (note !== undefined && (typeof note !== "string" || note.length > 200))
      return bad(res, "Note is too long");
    if (!Array.isArray(items) || items.length < 1 || items.length > 20)
      return bad(res, "Your cart is empty");

    const ids = [];
    for (const item of items) {
      if (typeof item !== "object" || item === null || typeof item.id !== "string" ||
          !mongoose.isValidObjectId(item.id) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)
        return bad(res, "Invalid item in cart");
      ids.push(item.id);
    }
    if (new Set(ids).size !== ids.length) return bad(res, "Duplicate items in cart");

    // IMPORTANT: prices come from the database, never from the browser
    const coffees = await Coffee.find({ _id: { $in: ids } });
    if (coffees.length !== ids.length) return bad(res, "An item is no longer available");

    const lines = items.map((item) => {
      const coffee = coffees.find((c) => c.id === item.id);
      return { coffee: coffee._id, name: coffee.name, price: coffee.price, quantity: item.quantity };
    });
    const total = Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100;

    const order = await Order.create({
      customerName: name, phone, note: note || "", items: lines, total,
    });
    res.status(201).json({ orderId: order.id, total: order.total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Cafe staff see the latest orders (needs the admin key)
router.get("/", adminOnly, async (req, res) => {
  try {
    res.json(await Order.find().sort({ createdAt: -1 }).limit(100));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;