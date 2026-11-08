const mongoose = require("mongoose");

// Only allow images we control: our own DB image route, or a file inside /images
const okImage = (v) =>
  v === "" ||
  /^\/api\/coffee\/[a-f0-9]{24}\/image(\?v=\d+)?$/.test(v) ||
  (/^\/images\/[\w\-. ()\/]+\.(jpg|jpeg|png|webp)$/i.test(v) && !v.includes(".."));

// Money is whole RWF: no decimals
const wholeMoney = {
  validator: Number.isInteger,
  message: "{PATH} must be a whole number of RWF",
};

const coffeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  price: { type: Number, required: true, min: 0, max: 1000000, validate: wholeMoney },
  // No default on purpose: old items have no cost, and the admin page shows "Not set" for them
  costPrice: { type: Number, min: 0, max: 1000000, validate: wholeMoney },
  category: { type: String, enum: ["Drinks", "Food", "Bakery"], default: "Food" },
  description: { type: String, trim: true, maxlength: 120, default: "" },
  image: { type: String, trim: true, default: "", validate: [okImage, "Invalid image path"] },
});

module.exports = mongoose.model("Coffee", coffeeSchema);