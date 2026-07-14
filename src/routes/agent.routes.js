const express = require("express");
const { chat } = require("../controllers/agent.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { rateLimit } = require("../middleware/rate-limit.middleware");

const router = express.Router();
const agentLimiter = rateLimit({
  scope: "agent_chat",
  maxRequests: 20,
  windowMs: 15 * 60 * 1000
});

router.use(authenticate);
router.post("/chat", agentLimiter, chat);

module.exports = router;
