const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  username: String,
  email: String,
  phoneNumber: { type: Number, default: "" },
  role: {
    type: String,
    enum: ["customer", "admin"], // Define acceptable roles
    default: "customer", // Set the default role
  },
  cart: {
    type: mongoose.Schema.Types.ObjectId, // Reference to cart document
    ref: "Cart", // Reference model name
  },
  password: String,
  passwordResetToken: String, // Add this line for resetToken
  passwordResetExpires: Date,
});

module.exports = mongoose.model("User", UserSchema);
