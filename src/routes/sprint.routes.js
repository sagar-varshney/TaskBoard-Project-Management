const express = require("express");
const { createSprint, listSprints } = require("../controllers/sprint.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listSprints);
router.post("/", requireRole("admin"), createSprint);

module.exports = router;
