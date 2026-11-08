const crypto = require("crypto");

const sessions = new Map(); // login token -> time it expires (lost when the server restarts)
const HOURS = 8;

// every 10 minutes, forget sessions that have already expired
setInterval(() => {
  const now = Date.now();
  for (const [token, expires] of sessions) if (expires < now) sessions.delete(token);
}, 10 * 60 * 1000).unref(); // unref: this timer never keeps the server alive on its own

function readCookie(req, name) {
  const found = (req.headers.cookie || "").split(";").map((s) => s.trim())
    .find((s) => s.startsWith(name + "="));
  if (!found) return "";
  try {
    return decodeURIComponent(found.slice(name.length + 1));
  } catch {
    return ""; // a broken cookie just means "not logged in"
  }
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
    httpOnly: true,            // JavaScript on the page cannot read this cookie
    sameSite: "strict",        // other websites cannot make the browser send it
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