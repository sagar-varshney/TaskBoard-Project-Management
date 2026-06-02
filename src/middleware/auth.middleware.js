const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const AppError = require("../utils/app-error");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authorization token is required", 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      `SELECT id, email, first_name, last_name, role, created_at
       FROM users
       WHERE id = ? AND deleted_at IS NULL`,
      [payload.userId]
    );

    if (rows.length === 0) {
      throw new AppError("User no longer exists", 401);
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      next(new AppError("Invalid or expired token", 401));
      return;
    }

    next(error);
  }
}

module.exports = {
  authenticate
};
