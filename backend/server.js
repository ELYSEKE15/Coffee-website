require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { adminOnly } = require("./middleware/adminOnly1");

const app = express();
app.disable("x-powered-by");

// A host like Render puts one proxy in front of the app. Trusting it lets the rate limiters see each
// visitor's real IP. Without this line every visitor looks the same and they all share ONE limit.
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const site = path.join(__dirname, "..");
const pages = path.join(site, "pages");

// Page not found: API paths get JSON, normal pages get the 404 page
function notFound(req, res) {
  if (req.path.startsWith("/api/")) return res.status(404).json({ message: "Not found" });
  res.status(404).sendFile(path.join(pages, "404.html"));
}

// ---------- secret admin page ----------
// Set ADMIN_PATH in .env (for example ADMIN_PATH=/staff-k8f3q9x2). The admin page then opens ONLY there
// and /admin.html stops working. A hidden address is not a lock: the strong password is the real lock.
const ADMIN_PATH = process.env.ADMIN_PATH || "";
if (/^\/[A-Za-z0-9_-]{8,40}$/.test(ADMIN_PATH)) {
  app.get("/admin.html", notFound);
  app.get(ADMIN_PATH, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(pages, "admin.html"));
  });
} else {
  console.warn("ADMIN_PATH is missing or invalid, so the admin page stays at /admin.html. " +
    "Add something like ADMIN_PATH=/staff-k8f3q9x2 to .env");
}

if ((process.env.ADMIN_KEY || "").length < 16) {
  console.warn("WARNING: ADMIN_KEY should be at least 16 characters. Make a strong one with: " +
    "node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\"");
}

// ---------- files ----------
app.use("/styles", express.static(path.join(site, "styles")));
app.use("/javascript", express.static(path.join(site, "javascript")));
app.use("/images", express.static(path.join(site, "images"), { maxAge: "7d" })); // photos rarely change
app.use("/vendor/fontawesome",
  express.static(path.join(__dirname, "node_modules/@fortawesome/fontawesome-free"), { maxAge: "30d" }));
app.use(express.static(pages));

// ---------- API ----------
// one general limit for the whole API (per visitor)
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 120, message: { message: "Too many requests. Slow down." } }));

// CHANGED: public contact info for the catering page. The number lives in .env, not in the page code.
// Only a number made of 8 to 15 digits is sent, anything else becomes an empty string.
app.get("/api/contact", (req, res) => {
  const number = process.env.CATERING_WHATSAPP || "";
  res.json({ whatsapp: /^[0-9]{8,15}$/.test(number) ? number : "" });
});

app.use("/api/coffee",
  (req, res, next) => (req.method === "GET" ? next() : adminOnly(req, res, next)),
  require("./routes/coffee"));

app.use("/api/orders",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { message: "Too many orders. Try later." } }),
  require("./routes/orders"));

app.use("/api/admin/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: { message: "Too many tries. Wait 15 minutes." } }));
app.use("/api/admin", require("./routes/admin"));

// ---------- unknown pages and errors ----------
app.use(notFound);

// Bad JSON, a body that is too big, or a crash: always a short safe message, never the error details
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  const message = status === 404 ? "Not found" : status < 500 ? "Bad request" : "Something went wrong";
  res.status(status).json({ message });
});

// Start the server only when this file is run directly (npm start). This also lets us test the app.
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => app.listen(process.env.PORT || 3000, () => console.log("Server running on port " + (process.env.PORT || 3000))))
    .catch((err) => { console.error("Database connection failed:", err.message); process.exit(1); });
}

module.exports = app;