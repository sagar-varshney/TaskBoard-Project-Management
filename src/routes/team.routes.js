const express = require("express");
const { createTeam, listTeams } = require("../controllers/team.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listTeams);
router.post("/", requireRole("admin"), createTeam);

module.exports = router;
