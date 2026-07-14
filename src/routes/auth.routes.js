const express = require("express");
const { login, logout, me, register } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { rateLimit } = require("../middleware/rate-limit.middleware");

const router = express.Router();

const authLimiter = rateLimit({
  scope: "auth",
  maxRequests: 10,
  windowMs: 15 * 60 * 1000
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

module.exports = router;
