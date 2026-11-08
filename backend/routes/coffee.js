const express = require("express");
const mongoose = require("mongoose");
const Coffee = require("../models/coffee");
const CoffeeImage = require("../models/coffeeImage");

const router = express.Router();

// Take only the fields we allow
function pick(body) {
  const data = {};
  for (const key of ["name", "price", "costPrice", "category", "description", "image"]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

// Reject a bad id before it reaches the database
function checkId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  next();
}

// Send a safe error message
function fail(res, err) {
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
}

// A real JPEG file always starts with these 3 bytes. We check the bytes, not the file name.
function isJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

// CREATE (admin only)
router.post("/", async (req, res) => {
  try {
    res.status(201).json(await Coffee.create(pick(req.body)));
  } catch (err) { fail(res, err); }
});

// READ all (public: the cost price must never be sent here)
router.get("/", async (req, res) => {
  try {
    res.json(await Coffee.find().select("-costPrice"));
  } catch (err) { fail(res, err); }
});

// READ one (public too, so the cost is hidden here as well)
router.get("/sort/:id", checkId, async (req, res) => {
  try {
    const coffee = await Coffee.findById(req.params.id).select("-costPrice");
    if (!coffee) return res.status(404).json({ message: "Not found" });
    res.json(coffee);
  } catch (err) { fail(res, err); }
});

// SHOW a photo (public, the menu page needs it)
router.get("/:id/image", checkId, async (req, res) => {
  try {
    const img = await CoffeeImage.findOne({ coffee: req.params.id });
    if (!img) return res.status(404).json({ message: "Not found" });
    res.set("Content-Type", img.contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(img.data);
  } catch (err) { fail(res, err); }
});

// UPLOAD or replace a photo (admin only)
router.put("/:id/image", checkId, express.raw({ type: "image/jpeg", limit: "300kb" }), async (req, res) => {
  try {
    if (!isJpeg(req.body)) {
      return res.status(400).json({ message: "Photo must be a JPEG under 300 KB" });
    }
    const coffee = await Coffee.findById(req.params.id);
    if (!coffee) return res.status(404).json({ message: "Not found" });

    await CoffeeImage.findOneAndUpdate(
      { coffee: coffee._id },
      { data: req.body, contentType: "image/jpeg" },
      { upsert: true }
    );
    // ?v=time makes browsers load the new photo instead of the old cached one
    coffee.image = "/api/coffee/" + coffee._id + "/image?v=" + Date.now();
    await coffee.save();
    res.json(coffee);
  } catch (err) { fail(res, err); }
});

// UPDATE (admin only)
router.put("/:id", checkId, async (req, res) => {
  try {
    const coffee = await Coffee.findByIdAndUpdate(req.params.id, pick(req.body), {
      returnDocument: "after",  // return the updated coffee
      runValidators: true,      // still check the rules
    });
    if (!coffee) return res.status(404).json({ message: "Not found" });
    res.json(coffee);
  } catch (err) { fail(res, err); }
});

// DELETE (admin only)
router.delete("/delete/:id", checkId, async (req, res) => {
  try {
    const coffee = await Coffee.findByIdAndDelete(req.params.id);
    if (!coffee) return res.status(404).json({ message: "Not found" });
    await CoffeeImage.deleteOne({ coffee: coffee._id });
    res.json({ message: "Deleted" });
  } catch (err) { fail(res, err); }
});

module.exports = router;