const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the User model
    required: true,
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product", // Reference to the Product model
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: String,
        required: true,
      },
      productName: {
        type: String, // Add product name for display
      },
    },
  ],
  date: {
    type: Date,
    default: Date.now, // Set default to current date
  },
  paymentMethod: {
    type: String, // Ensure consistent casing
    required: true,
  },
});

module.exports = mongoose.model("Order", orderSchema);
