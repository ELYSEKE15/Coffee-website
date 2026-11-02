const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/order");
const Coffee = require("../models/coffee");
const { adminOnly, isAdmin, login, logout } = require("../middleware/adminOnly1");

const router = express.Router();
const STATUSES = ["new", "preparing", "ready", "done", "cancelled"];

function fail(res, err) {
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
}

// These three work without logging in
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", (req, res) => res.json({ admin: isAdmin(req) }));

// Everything below needs a logged-in admin
router.use(adminOnly);

router.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [orders, newOrders, todayOrders, items, sales] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: "new" }),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Coffee.countDocuments(),
      Order.aggregate([{ $match: { status: "done" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    ]);
    res.json({ orders, newOrders, todayOrders, items, sales: sales[0] ? sales[0].total : 0 });
  } catch (err) { fail(res, err); }
});

router.get("/orders", async (req, res) => {
  try {
    const filter = {};
    if (typeof req.query.status === "string" && STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
  } catch (err) { fail(res, err); }
});

router.patch("/orders/:id", async (req, res) => {
  try {
    const status = req.body && req.body.status;
    if (!mongoose.isValidObjectId(req.params.id) || !STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: "Not found" });
    res.json(order);
  } catch (err) { fail(res, err); }
});

module.exports = router;