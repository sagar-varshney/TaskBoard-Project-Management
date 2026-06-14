const express = require("express");
const { chat } = require("../controllers/agent.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.post("/chat", chat);

module.exports = router;
