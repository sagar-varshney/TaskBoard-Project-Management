const express = require("express");
const {
  createProject,
  listProjects
} = require("../controllers/project.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listProjects);
router.post("/", requireRole("admin"), createProject);

module.exports = router;
