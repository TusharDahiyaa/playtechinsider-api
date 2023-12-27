const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const Order = require("../models/Order");
const cookieParser = require("cookie-parser");

const router = express.Router();

// Use the cookie-parser middleware
router.use(cookieParser());

router.post("/", authenticateUser, async (req, res) => {
  try {
    const cartItems = req.body.cart;
    const paymentMethodUsed = req.body.PaymentMethod;

    if (!cartItems || !Array.isArray(cartItems)) {
      throw new Error("No items in your cart!");
    }

    const order = new Order({
      userId: req.user._id,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.productId.new_price,
        productName: item.productId.name,
      })),
      date: new Date(), // Leverage default date
      paymentMethod: paymentMethodUsed,
    });

    await order.save();

    res.json({ orderId: order._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.get("/", authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.sendStatus(401).json("Unauthorized");
    }

    const userOrders = await Order.find({ userId });

    if (!userOrders || userOrders.length === 0) {
      res.status(200).json([]); // Return empty array for clarity
    } else {
      res.status(200).json(userOrders);
    }
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

module.exports = router;
