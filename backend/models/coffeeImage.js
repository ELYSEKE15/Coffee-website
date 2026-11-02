const mongoose = require("mongoose");

const coffeeImageSchema = new mongoose.Schema({
  coffee: { type: mongoose.Schema.Types.ObjectId, ref: "Coffee", required: true, unique: true },
  contentType: { type: String, default: "image/jpeg" },
  data: { type: Buffer, required: true },
});

module.exports = mongoose.model("CoffeeImage", coffeeImageSchema);