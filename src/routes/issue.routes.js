const express = require("express");
const {
  createIssue,
  listIssues,
  updateIssueStatus
} = require("../controllers/issue.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listIssues);
router.post("/", createIssue);
router.patch("/:id/status", updateIssueStatus);

module.exports = router;
