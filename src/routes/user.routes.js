const express = require("express");
const { listUsers } = require("../controllers/user.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listUsers);

module.exports = router;
