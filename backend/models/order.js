const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 60 },
  phone: { type: String, required: true, trim: true },
  note: { type: String, trim: true, maxlength: 200, default: "" },
  // how the customer says they will pay at pickup (no online payment yet)
  paymentMethod: { type: String, enum: ["pickup", "momo", "airtel"], default: "pickup" },
  // name, price and costPrice are copied, so old orders and old profit stay correct if the menu changes later
  items: [{
    coffee: { type: mongoose.Schema.Types.ObjectId, ref: "Coffee", required: true },
    name: String,
    price: Number,
    costPrice: Number, // stays empty if the menu item had no cost yet
    quantity: Number,
  }],
  total: { type: Number, required: true },
  status: { type: String, enum: ["new", "preparing", "ready", "done", "cancelled"], default: "new" },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);