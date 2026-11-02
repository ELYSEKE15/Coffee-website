require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { adminOnly } = require("./middleware/adminOnly1");

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));   


const site = path.join(__dirname, "..");
app.use("/styles", express.static(path.join(site, "styles")));
app.use("/javascript", express.static(path.join(site, "javascript")));
app.use("/images", express.static(path.join(site, "images")));
app.use("/vendor/fontawesome",
  express.static(path.join(__dirname, "node_modules/@fortawesome/fontawesome-free")));
app.use(express.static(path.join(site, "pages")));


app.use("/api/coffee",
  (req, res, next) => (req.method === "GET" ? next() : adminOnly(req, res, next)),
  require("./routes/coffee"));


app.use("/api/orders",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { message: "Too many orders. Try later." } }),
  require("./routes/orders"));

app.use("/api/admin/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: { message: "Too many tries. Wait 15 minutes." } }));
app.use("/api/admin", require("./routes/admin"));

mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(process.env.PORT || 3000, () => console.log("Server running on port " + (process.env.PORT || 3000))))
  .catch((err) => { console.error("Database connection failed:", err.message); process.exit(1); });