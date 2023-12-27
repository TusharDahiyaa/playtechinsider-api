const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: String,
  category: String,
  description: String,
  old_price: String,
  new_price: String,
  imageUrl: String,
});

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
