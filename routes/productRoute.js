const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const authenticateUser = require("../middleware/authMiddleware");
const cookieParser = require("cookie-parser");
const router = express.Router();

// Use the cookie-parser middleware
router.use(cookieParser());

router.get("/api/products", async (req, res) => {
  try {
    // Fetch products from the database using your Product model
    const products = await Product.find();

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/products", async (req, res) => {
  try {
    // Get product data from the request body
    const { name, category, description, old_price, new_price, imageUrl } =
      req.body;

    // Create a new product instance
    const newProduct = new Product({
      name,
      category,
      description,
      old_price,
      new_price,
      imageUrl,
    });

    // Save the product to the database
    await newProduct.save();

    res.status(201).json({ message: "Product added successfully" });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/user/cart", authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const userCart = await Cart.findOne({ userId }).populate("items.productId");

    if (!userCart) {
      res.status(203).json({});
    } else {
      res.status(200).json(userCart.items);
    }
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

router.post("/user/cart/add", authenticateUser, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const cart = await Cart.findOne({ userId: req.user._id });

    if (!cart) {
      const newCart = new Cart({ userId: req.user._id });
      newCart.items.push({ productId, quantity });
      await newCart.save();
      return res.json({ message: "Item added to cart." });
    }

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    await cart.save();
    return res.json({ message: "Item added to cart." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.put("/user/cart/update/:itemId", authenticateUser, async (req, res) => {
  const { itemId, quantity } = req.body;

  if (!quantity || typeof quantity !== "number") {
    return res.status(400).json({ message: "Invalid quantity." });
  }

  const cart = await Cart.findOne({ userId: req.user._id });
  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === itemId
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: "Item not found." });
  }

  if (quantity) {
    cart.items[itemIndex].quantity = quantity;
  }

  await cart.save();
  return res.json({ message: "Item information updated.", cart });
});

router.delete(
  "/user/cart/remove/:itemId",
  authenticateUser,
  async (req, res) => {
    try {
      const { itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({ message: "Missing required fields." });
      }

      const cart = await Cart.findOne({ userId: req.user._id });

      if (!cart) {
        return res.status(404).json({ message: "Cart not found." });
      }

      cart.items = cart.items.filter((item) => item._id.toString() !== itemId);

      await cart.save();
      return res.json({ message: "Item removed from cart.", cart });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }
);

router.delete("/user/cart/clearCart", authenticateUser, async (req, res) => {
  try {
    const cartToBeDeleted = await Cart.findOneAndDelete({
      userId: req.user._id,
    }).then(() => {
      return res.json({ message: "Cart cleared successfully." });
    });

    if (!cartToBeDeleted) {
      return res.status(404).json({ error: "Cart not found." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
