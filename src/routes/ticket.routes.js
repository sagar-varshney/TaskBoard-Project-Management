const express = require("express");
const {
  createIssue,
  createIssueSummary,
  getIssue,
  listIssues,
  updateIssue
} = require("../controllers/issue.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listIssues);
router.get("/:id", getIssue);
router.post("/", createIssue);
router.patch("/:id", requireRole("admin"), updateIssue);
router.post("/:id/ai-summary", requireRole("admin"), createIssueSummary);

module.exports = router;
