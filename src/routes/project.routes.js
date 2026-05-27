const express = require("express");
const {
  createProject,
  listProjects
} = require("../controllers/project.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listProjects);
router.post("/", createProject);

module.exports = router;
