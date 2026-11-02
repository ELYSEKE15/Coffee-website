const mongoose = require("mongoose");

// Only pictures from our own /images folder are allowed
const okImage = (v) =>
  v === "" || (/^\/images\/[\w\-. ()\/]+\.(jpg|jpeg|png|webp)$/i.test(v) && !v.includes(".."));

const coffeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },          // price in RWF
  category: { type: String, enum: ["Drinks", "Food", "Bakery"], default: "Food" },
  description: { type: String, trim: true, maxlength: 120, default: "" },
  image: { type: String, trim: true, default: "", validate: [okImage, "Invalid image path"] },
});

module.exports = mongoose.model("Coffee", coffeeSchema);