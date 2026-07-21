const express = require("express");
const { createCompanyWithAdmin } = require("../controllers/company.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.post("/", requireRole("admin"), createCompanyWithAdmin);

module.exports = router;
