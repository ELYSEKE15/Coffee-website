const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 60 },
  phone: { type: String, required: true, trim: true },
  note: { type: String, trim: true, maxlength: 200, default: "" },
  // name and price are copied, so old orders stay correct if the menu changes later
  items: [{
    coffee: { type: mongoose.Schema.Types.ObjectId, ref: "Coffee", required: true },
    name: String,
    price: Number,
    quantity: Number,
  }],
  total: { type: Number, required: true },
  status: { type: String, enum: ["new", "preparing", "ready", "done", "cancelled"], default: "new" },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);