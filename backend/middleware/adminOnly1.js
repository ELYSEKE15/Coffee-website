const crypto = require("crypto");

const sessions = new Map(); // login token -> time it expires (lost when the server restarts)
const HOURS = 8;

function readCookie(req, name) {
  const found = (req.headers.cookie || "").split(";").map((s) => s.trim())
    .find((s) => s.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

// timingSafeEqual compares without leaking how many characters matched
function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isAdmin(req) {
  const token = readCookie(req, "admin");
  const expires = sessions.get(token);
  if (!expires) return false;
  if (expires < Date.now()) { sessions.delete(token); return false; }
  return true;
}

function adminOnly(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ message: "Please log in" });
  next();
}

function login(req, res) {
  const password = req.body && req.body.password;
  const real = process.env.ADMIN_KEY || "";
  if (real.length < 12) return res.status(500).json({ message: "Enter valid password" });
  if (typeof password !== "string" || !safeEqual(password, real)) {
    return res.status(401).json({ message: "Wrong password" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + HOURS * 3600 * 1000);
  res.cookie("admin", token, {
    httpOnly: true,            
    sameSite: "strict",       
    secure: process.env.NODE_ENV === "production",
    maxAge: HOURS * 3600 * 1000,
  });
  res.json({ ok: true });
}

function logout(req, res) {
  sessions.delete(readCookie(req, "admin"));
  res.clearCookie("admin");
  res.json({ ok: true });
}

module.exports = { adminOnly, isAdmin, login, logout };