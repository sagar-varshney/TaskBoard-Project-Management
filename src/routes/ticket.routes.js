const express = require("express");
const {
  createIssueComment,
  createIssue,
  createIssueSummary,
  deleteIssueComment,
  getIssue,
  listIssueActivity,
  listIssueComments,
  listIssues,
  listMyIssues,
  updateIssueComment,
  updateIssue
} = require("../controllers/issue.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listIssues);
router.get("/my", listMyIssues);
router.get("/:id", getIssue);
router.get("/:id/activity", listIssueActivity);
router.get("/:id/comments", listIssueComments);
router.post("/", createIssue);
router.patch("/:id", updateIssue);
router.post("/:id/comments", createIssueComment);
router.patch("/:id/comments/:commentId", updateIssueComment);
router.delete("/:id/comments/:commentId", deleteIssueComment);
router.post("/:id/ai-summary", requireRole("admin"), createIssueSummary);

module.exports = router;
