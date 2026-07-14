const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { config } = require("../config/env");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((item) => item.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const hasBearerToken = Boolean(authHeader?.startsWith("Bearer "));
    const cookieToken = readCookie(req, config.auth.cookieName);

    // Protected routes expect: Authorization: Bearer <jwt>
    if (!hasBearerToken && !cookieToken) {
      logger.warn("unauthorized_api_attempt", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
      });
      throw new AppError("Authorization token is required", 401);
    }

    if (!hasBearerToken && cookieToken && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const csrfCookie = readCookie(req, config.auth.csrfCookieName);
      const csrfHeader = req.headers["x-csrf-token"];

      if (!csrfCookie || csrfHeader !== csrfCookie) {
        logger.warn("csrf_validation_failed", {
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip
        });
        throw new AppError("CSRF token is required", 403);
      }
    }

    const token = hasBearerToken ? authHeader.split(" ")[1] : cookieToken;
    // jwt.verify checks the signature and expiry using the same secret used during login/register.
    const payload = jwt.verify(token, config.jwt.secret);

    // Soft-deleted users are blocked even if they still have an old valid token.
    const [rows] = await pool.execute(
      `SELECT id, email, first_name, last_name, role, token_version, created_at
       FROM users
       WHERE id = ? AND deleted_at IS NULL`,
      [payload.userId]
    );

    if (rows.length === 0) {
      throw new AppError("User no longer exists", 401);
    }

    if ((payload.tokenVersion || 0) !== rows[0].token_version) {
      throw new AppError("Token has been revoked", 401);
    }

    // Controllers and role middleware read req.user instead of decoding the token again.
    const { token_version: ignoredTokenVersion, ...user } = rows[0];
    req.user = user;
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
