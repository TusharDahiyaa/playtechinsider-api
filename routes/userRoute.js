const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Cart = require("../models/Cart");
const authenticateUser = require("../middleware/authMiddleware");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
require("dotenv").config();

const router = express.Router();

router.use(cookieParser());

router.post("/signup", async (req, res) => {
  const { name, email, username, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  try {
    const existingUserWithEmail = await User.findOne({ email: email });
    const existingUserWithUsername = await User.findOne({ username: username });

    if (existingUserWithEmail || existingUserWithUsername) {
      return res.status(409).json({
        error: existingUserWithEmail
          ? "Email already exists"
          : "Username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      username,
      password: hashedPassword,
      role: "customer", //Default role
    });
    await user.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(400).json({ error: "User not created" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "User does not exist" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid password" });
    }
    // User is authenticated, generate a JWT token
    const token = jwt.sign({ _id: user._id }, process.env.secret_key);
    res.cookie("access_token", token, {
      httpOnly: true,
      path: "/",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      sameSite: "None",
      secure: true,
    });

    // Associating the cart with the user
    const cart = await Cart.findOne({ userId: user._id });
    if (!cart) {
      await Cart.create({ userId: user._id, items: [] });
    }

    // if (token) {
    //   console.log("Access_token saved");
    // }
    res.status(200).json({ message: "Logged in successfully", token });
  } catch (error) {
    res.status(400).json({ error: "Login failed" });
  }
});

router.post("/forgetpassword", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User does not exist" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.passwordResetToken = hash;
    user.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.mail_id,
        pass: process.env.mail_pass,
      },
    });

    const mailOptions = {
      from: process.env.mail_id,
      to: email,
      subject: "Reset Password link(PlayTechInsider)",
      text: `Hi,

Please click on the following link to reset your password: ${process.env.REACT_APP_FRONTENDURL}/resetpassword/${user.passwordResetToken}.

Thank You,
Play Tech Insider`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: `Email has been sent to ${email}` });
  } catch (error) {
    res.status(400).json({ error: "Email not sent" });
  }
});

router.post("/resetpassword/:resetToken", async (req, res) => {
  const resetToken = req.params.resetToken;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  try {
    const user = await User.findOne({ passwordResetToken: resetToken });
    // console.log("User found in the database:", user);

    if (!user) {
      return res
        .status(404)
        .json({ error: "Link is expired. Generate a new reset link." });
    }

    const passwordCompare = await bcrypt.compare(password, user.password);

    // Using bcrypt.compare for secure comparison
    if (passwordCompare) {
      return res.status(400).json({
        error: "New password cannot be the same as the current password",
      });
    } else {
      // Clear the reset token and expiration
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      res.status(200).json({ message: "Password reset successfully" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({ error: "Password reset failed" });
  }
});

router.get("/checkLoggedIn", authenticateUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // Verify the token to get the payload, which includes the user ID
    const decoded = jwt.verify(token, process.env.secret_key);

    const userId = decoded._id;

    // The user is logged in, send user information if needed
    res.status(200).json({ user: req.user, userId });
  } catch (error) {
    console.error("Error checking login status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/checkUserRole", authenticateUser, async (req, res) => {
  try {
    const userRole = req.userRole;

    res.status(200).json({ role: userRole });
  } catch (error) {
    console.error("Error checking user role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/setAdminRole/:userId", authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;
    const userObjectId = await User.findOne({ username: userId });
    if (!userObjectId) throw new Error(`No user with username ${userId}`);

    // Verify user ID format
    if (!mongoose.isValidObjectId(userObjectId._id)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Check if user is authenticated and authorized
    if (!req.user || !req.user.role || req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (userObjectId.role === "admin") {
      return res.status(202).json({ message: "User is already an admin!" });
    }

    // Update user role
    const updatedUser = await User.findByIdAndUpdate(
      userObjectId._id, // Update user by ID
      { role: "admin" }, // Update role to "admin"
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    // Log and respond
    // console.log("User role updated successfully", updatedUser);
    res.status(200).json({ message: "User role updated to admin" });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", authenticateUser, async (req, res) => {
  try {
    // Clear the access_token cookie
    res.clearCookie("access_token", { sameSite: "None", secure: true });
    console.log("Access_token cleared");
    return res.status(200).json({ message: "Successfully logged out 😏🍀" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/user/details", authenticateUser, async (req, res) => {
  try {
    const user = req.user._id;

    const userDetails = await User.findOne({ _id: user });

    if (!userDetails) {
      return res.status(400).json({ error: "User does not exist" });
    }

    res.status(200).json({ userDetails });
  } catch (error) {
    console.error("Error finding user details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/user/update-name", authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const userData = await User.findOne(userId);

    // Validate and update name
    const { name } = req.body;
    userData.name = name;
    await userData.save();

    res.status(200).json({ message: "Name updated successfully", userData });
  } catch (error) {
    console.error("Error updating name:", error);
    res.status(500).send("Error updating name");
  }
});

router.put("/user/update-phone-number", authenticateUser, async (req, res) => {
  try {
    // Access user data from request
    const userData = await User.findOne(req.user._id);

    // Validate and update phone number
    const { phoneNumber } = req.body;

    const regex = /^\d{10}$/;
    const isValidNumber = regex.test(phoneNumber);

    if (!isValidNumber) {
      return res.status(400).json({ error: "Invalid phone number format" });
    } else {
      userData.phoneNumber = phoneNumber;
      await userData.save();

      res
        .status(200)
        .json({ message: "Phone number updated successfully", userData });
    }
  } catch (error) {
    console.error("Error updating phone number:", error);
    res.status(500).json({ error: "Error updating phone number" });
  }
});

router.put("/user/change-password", authenticateUser, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = await User.findOne(req.user._id);

  try {
    // Validate current password (if provided)
    if (currentPassword) {
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(400).json({ error: "Invalid current password" });
      }
    }

    // Validation to check if new password is the same as current password
    if (newPassword === currentPassword) {
      return res.status(400).json({
        error: "New password cannot be the same as the current password",
      });
    }

    // Validate new password and confirm password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    // Update the user's password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
