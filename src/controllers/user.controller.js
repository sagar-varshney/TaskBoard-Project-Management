const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

async function listUsers(req, res, next) {
  try {
    const [users] = await pool.execute(
      `SELECT id, email, first_name, last_name, role
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY first_name ASC, last_name ASC`
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function listBlockedUsers(req, res, next) {
  try {
    const [users] = await pool.execute(
      `SELECT id, email, first_name, last_name, role, deleted_at
       FROM users
       WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("A valid user id is required", 400);
    }

    if (userId === req.user.id) {
      throw new AppError("You cannot block your own account", 400);
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
           token_version = token_version + 1
       WHERE id = ?`,
      [userId]
    );

    if (result.affectedRows === 0) {
      throw new AppError("User not found", 404);
    }

    logger.audit("user_blocked", req, {
      targetUserId: userId
    });

    res.json({
      message: "User blocked successfully"
    });
  } catch (error) {
    next(error);
  }
}

async function unblockUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("A valid user id is required", 400);
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET deleted_at = NULL,
           token_version = token_version + 1
       WHERE id = ?`,
      [userId]
    );

    if (result.affectedRows === 0) {
      throw new AppError("User not found", 404);
    }

    logger.audit("user_unblocked", req, {
      targetUserId: userId
    });

    res.json({
      message: "User unblocked successfully"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  blockUser,
  listBlockedUsers,
  listUsers,
  unblockUser
};
