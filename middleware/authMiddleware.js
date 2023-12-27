const jwt = require("jsonwebtoken");
const User = require("../models/User");
const cookieParser = require("cookie-parser");
const express = require("express");

const app = express();
app.use(cookieParser());

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      // If no token, user is not authenticated
      return res.status(401).json({ error: "User not logged in!" });
    }

    const decoded = jwt.verify(token, process.env.secret_key);
    const user = await User.findById(decoded);

    if (!user) {
      // If user not found, token is invalid
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Attach both user and role to the request for further use
    req.user = user;

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.userRole = user.role;

    next();
  } catch (error) {
    console.error("Error authenticating user:", error);
    return res.status(401).json({ error: "Error authenticating the user" });
  }
};

module.exports = authenticateUser;
