const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/order");
const Coffee = require("../models/coffee");
const { adminOnly, isAdmin, login, logout } = require("../middleware/adminOnly1");

const router = express.Router();
const STATUSES = ["new", "preparing", "ready", "done", "cancelled"];
const TZ = "Africa/Kigali"; // Render runs in UTC, so we say which time zone the cafe's "day" follows
const DAY = 24 * 3600 * 1000;

function fail(res, err) {
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
}

// "2026-11-06": the date of a moment, as seen in Kigali
function dayKey(date) {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });
}

// Sales and profit for the last 7 or 30 days, one row per day.
// Only "done" orders count, the same rule the dashboard already used for sales.
async function buildReport(days) {
  const since = new Date(Date.now() - (days + 1) * DAY); // one extra day, rows outside the range are skipped below
  const [orders, menu] = await Promise.all([
    Order.find({ status: "done", createdAt: { $gte: since } }).lean(),
    Coffee.find().select("name costPrice").lean(),
  ]);
  const costByName = new Map(menu.map((m) => [m.name, m.costPrice]));

  // an empty row for every day, so a day with no sales still shows as 0
  const rows = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(Date.now() - i * DAY);
    rows.set(date, { date, orders: 0, revenue: 0, cost: 0 });
  }

  const sold = new Map(); // item name -> how many were sold
  let missingCost = 0; // items sold that have no cost price, so the profit is too high

  for (const order of orders) {
    const row = rows.get(dayKey(order.createdAt));
    if (!row) continue;
    row.orders += 1;
    row.revenue += order.total;
    for (const item of order.items) {
      // the cost saved inside the order wins; older orders fall back to the menu's current cost
      const unitCost = typeof item.costPrice === "number" ? item.costPrice : costByName.get(item.name);
      if (typeof unitCost === "number") row.cost += unitCost * item.quantity;
      else missingCost += item.quantity;
      sold.set(item.name, (sold.get(item.name) || 0) + item.quantity);
    }
  }

  const list = [...rows.values()].map((r) => ({ ...r, profit: r.revenue - r.cost }));
  const totals = { orders: 0, revenue: 0, cost: 0, profit: 0 };
  for (const r of list) {
    totals.orders += r.orders;
    totals.revenue += r.revenue;
    totals.cost += r.cost;
    totals.profit += r.profit;
  }
  const top = [...sold]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return { days: list, totals, top, missingCost };
}

// only 7 or 30 are allowed, anything else becomes 7
function readDays(req) {
  return req.query.days === "30" ? 30 : 7;
}

// These three work without logging in
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", (req, res) => res.json({ admin: isAdmin(req) }));

// Everything below needs a logged-in admin
router.use(adminOnly);

// money and customer data should never be saved in a browser cache
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// The full menu WITH cost prices. The public /api/coffee hides them,
// so the admin page reads the menu from here instead.
router.get("/menu", async (req, res) => {
  try {
    res.json(await Coffee.find());
  } catch (err) { fail(res, err); }
});

router.get("/stats", async (req, res) => {
  try {
    // midnight in Kigali (UTC+2, no summer time), not midnight on the server
    const today = new Date(dayKey(Date.now()) + "T00:00:00+02:00");
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

router.get("/report", async (req, res) => {
  try {
    res.json(await buildReport(readDays(req)));
  } catch (err) { fail(res, err); }
});

// the same report as a file the owner can open in Excel
router.get("/report.csv", async (req, res) => {
  try {
    const report = await buildReport(readDays(req));
    const t = report.totals;
    const lines = ["Date,Orders,Sales (RWF),Cost (RWF),Profit (RWF)"];
    report.days.forEach((d) => lines.push([d.date, d.orders, d.revenue, d.cost, d.profit].join(",")));
    lines.push(["Total", t.orders, t.revenue, t.cost, t.profit].join(","));
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="report-' + report.days.length + '-days.csv"',
    });
    res.send(lines.join("\n"));
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