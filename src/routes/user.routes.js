const express = require("express");
const {
  blockUser,
  listBlockedUsers,
  listUsers,
  unblockUser
} = require("../controllers/user.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", listUsers);
router.get("/blocked", requireRole("admin"), listBlockedUsers);
router.patch("/:id/block", requireRole("admin"), blockUser);
router.patch("/:id/unblock", requireRole("admin"), unblockUser);

module.exports = router;
