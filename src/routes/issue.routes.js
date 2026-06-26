const express = require("express");
const multer = require("multer");
const {
  createIssueComment,
  createIssue,
  deleteIssueComment,
  getIssue,
  listIssueActivity,
  listIssueComments,
  listIssues,
  listMyIssues,
  updateIssueComment,
  updateIssue,
  updateIssueStatus
} = require("../controllers/issue.controller");
const {
  analyzeIssueAttachment,
  completePresignedAttachmentUpload,
  createAttachmentComment,
  createIssueAttachment,
  createPresignedAttachmentUpload,
  deleteIssueAttachment,
  downloadIssueAttachment,
  listAttachmentAnalyses,
  listAttachmentComments,
  listIssueAttachments
} = require("../controllers/attachment.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

router.use(authenticate);
router.get("/", listIssues);
router.get("/my", listMyIssues);
router.get("/:id", getIssue);
router.get("/:id/activity", listIssueActivity);
router.get("/:id/comments", listIssueComments);
router.get("/:id/attachments", listIssueAttachments);
router.post("/", createIssue);
router.patch("/:id", updateIssue);
router.patch("/:id/status", updateIssueStatus);
router.post("/:id/comments", createIssueComment);
router.patch("/:id/comments/:commentId", updateIssueComment);
router.delete("/:id/comments/:commentId", deleteIssueComment);
router.post("/:id/attachments", attachmentUpload.single("attachment"), createIssueAttachment);
router.post("/:id/attachments/presign", createPresignedAttachmentUpload);
router.post("/:id/attachments/complete", completePresignedAttachmentUpload);
router.get("/:id/attachments/:attachmentId/download", downloadIssueAttachment);
router.post("/:id/attachments/:attachmentId/analyze", analyzeIssueAttachment);
router.get("/:id/attachments/:attachmentId/analyses", listAttachmentAnalyses);
router.get("/:id/attachments/:attachmentId/comments", listAttachmentComments);
router.post("/:id/attachments/:attachmentId/comments", createAttachmentComment);
router.delete("/:id/attachments/:attachmentId", deleteIssueAttachment);

module.exports = router;
