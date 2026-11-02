const express = require("express");
const mongoose = require("mongoose");
const Coffee = require("../models/coffee");

const router = express.Router();

// Take only the fields we allow
// Take only the fields we allow
function pick(body) {
  const data = {};
  for (const key of ["name", "price", "category", "description", "image"]) {
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

// CREATE
router.post("/", async (req, res) => {
  try {
    res.status(201).json(await Coffee.create(pick(req.body)));
  } catch (err) { fail(res, err); }
});

// READ all
router.get("/", async (req, res) => {
  try {
    res.json(await Coffee.find());
  } catch (err) { fail(res, err); }
});

// READ one
router.get("/sort/:id", checkId, async (req, res) => {
  try {
    const coffee = await Coffee.findById(req.params.id);
    if (!coffee) return res.status(404).json({ message: "Not found" });
    res.json(coffee);
  } catch (err) { fail(res, err); }
});

// UPDATE
router.put("/:id", checkId, async (req, res) => {
  try {
    const coffee = await Coffee.findByIdAndUpdate(req.params.id, pick(req.body), {
      new: true,            // return the updated coffee
      runValidators: true,  // still check the rules
    });
    if (!coffee) return res.status(404).json({ message: "Not found" });
    res.json(coffee);
  } catch (err) { fail(res, err); }
});

// DELETE
router.delete("/delete/:id", checkId, async (req, res) => {
  try {
    const coffee = await Coffee.findByIdAndDelete(req.params.id);
    if (!coffee) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) { fail(res, err); }
});

module.exports = router;