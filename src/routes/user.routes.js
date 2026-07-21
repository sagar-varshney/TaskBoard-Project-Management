const express = require("express");
const {
  blockUser,
  createEmployee,
  createEmployeesBulk,
  listAssignableUsers,
  listBlockedUsers,
  listUsers,
  unblockUser,
  updateUserRole
} = require("../controllers/user.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", requireRole("admin"), listUsers);
router.post("/", requireRole("admin"), createEmployee);
router.post("/bulk", requireRole("admin"), createEmployeesBulk);
router.get("/assignable", listAssignableUsers);
router.get("/blocked", requireRole("admin"), listBlockedUsers);
router.patch("/:id/role", requireRole("admin"), updateUserRole);
router.patch("/:id/block", requireRole("admin"), blockUser);
router.patch("/:id/unblock", requireRole("admin"), unblockUser);

module.exports = router;
