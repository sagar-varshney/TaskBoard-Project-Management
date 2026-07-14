const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { pool } = require("../config/db");
const { config } = require("../config/env");
const AppError = require("../utils/app-error");
const { signToken } = require("../utils/jwt");
const logger = require("../utils/logger");

async function ensureLoginAttemptTable() {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS auth_login_attempts (
       email VARCHAR(255) PRIMARY KEY,
       failed_count INT UNSIGNED NOT NULL DEFAULT 0,
       first_failed_at TIMESTAMP NULL DEFAULT NULL,
       locked_until TIMESTAMP NULL DEFAULT NULL,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     )`
  );
}

function tokenCookieOptions(maxAgeSeconds) {
  const options = [
    "HttpOnly",
    "Path=/",
    "SameSite=None",
    `Max-Age=${maxAgeSeconds}`
  ];

  if (config.app.isProduction) {
    options.push("Secure");
  }

  return options.join("; ");
}

function readableCookieOptions(maxAgeSeconds) {
  const options = [
    "Path=/",
    "SameSite=None",
    `Max-Age=${maxAgeSeconds}`
  ];

  if (config.app.isProduction) {
    options.push("Secure");
  }

  return options.join("; ");
}

function appendCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");

  if (!current) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }

  res.setHeader("Set-Cookie", Array.isArray(current) ? [...current, cookie] : [current, cookie]);
}

function setAuthCookie(res, token) {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  appendCookie(res, `${config.auth.cookieName}=${encodeURIComponent(token)}; ${tokenCookieOptions(24 * 60 * 60)}`);
  appendCookie(res, `${config.auth.csrfCookieName}=${csrfToken}; ${readableCookieOptions(24 * 60 * 60)}`);
}

function clearAuthCookie(res) {
  appendCookie(res, `${config.auth.cookieName}=; ${tokenCookieOptions(0)}`);
  appendCookie(res, `${config.auth.csrfCookieName}=; ${readableCookieOptions(0)}`);
}

async function getLoginAttempt(email) {
  await ensureLoginAttemptTable();
  const [rows] = await pool.execute(
    `SELECT email, failed_count, first_failed_at, locked_until
     FROM auth_login_attempts
     WHERE email = ?`,
    [email]
  );

  return rows[0];
}

async function resetLoginAttempts(email) {
  await ensureLoginAttemptTable();
  await pool.execute(
    "DELETE FROM auth_login_attempts WHERE email = ?",
    [email]
  );
}

async function recordFailedLogin(email, req) {
  await ensureLoginAttemptTable();
  const attempt = await getLoginAttempt(email);
  const now = Date.now();
  const windowMs = config.auth.failedLoginWindowMinutes * 60 * 1000;
  const firstFailedAt = attempt?.first_failed_at ? new Date(attempt.first_failed_at).getTime() : now;
  const withinWindow = now - firstFailedAt <= windowMs;
  const failedCount = withinWindow ? Number(attempt?.failed_count || 0) + 1 : 1;
  const lockedUntil =
    failedCount >= config.auth.failedLoginLimit
      ? new Date(now + config.auth.lockoutMinutes * 60 * 1000)
      : null;

  await pool.execute(
    `INSERT INTO auth_login_attempts (email, failed_count, first_failed_at, locked_until)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       failed_count = VALUES(failed_count),
       first_failed_at = VALUES(first_failed_at),
       locked_until = VALUES(locked_until)`,
    [
      email,
      failedCount,
      new Date(withinWindow ? firstFailedAt : now),
      lockedUntil
    ]
  );

  logger.warn("login_failed", {
    requestId: req.requestId,
    email,
    failedCount,
    locked: Boolean(lockedUntil),
    ip: req.ip
  });
}

async function assertLoginNotLocked(email) {
  const attempt = await getLoginAttempt(email);

  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
    throw new AppError("Too many failed login attempts. Please try again later.", 423);
  }
}

function validateRegisterInput(body) {
  const { email, password, firstName, lastName } = body;

  // Register requires the exact fields specified in the original task.
  if (!email || !password || !firstName || !lastName) {
    throw new AppError("Email, password, firstName and lastName are required", 400);
  }

  if (!email.includes("@")) {
    throw new AppError("Please provide a valid email", 400);
  }

  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }
}

function validateLoginInput(body) {
  const { email, password } = body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }
}

async function register(req, res, next) {
  try {
    if (!config.auth.allowPublicRegistration) {
      throw new AppError("Public registration is disabled. Please contact an administrator for access.", 403);
    }

    validateRegisterInput(req.body);

    const { email, password, firstName, lastName } = req.body;
    // Normalize email so Test@Email.com and test@email.com are treated as the same account.
    const normalizedEmail = email.toLowerCase().trim();

    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      throw new AppError("Email is already registered", 409);
    }

    // bcrypt stores a one-way password hash; the real password is never saved.
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, 'member')",
      [normalizedEmail, passwordHash, firstName.trim(), lastName.trim()]
    );

    const user = {
      id: result.insertId,
      email: normalizedEmail,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: "member",
      token_version: 0
    };
    const token = signToken(user);
    const { token_version: ignoredTokenVersion, ...safeUser } = user;
    setAuthCookie(res, token);

    res.status(201).json({
      message: "Registered successfully",
      // The token lets the new user immediately access protected routes.
      token,
      user: safeUser
    });
    logger.audit("user_registered", req, {
      targetUserId: result.insertId,
      email: normalizedEmail
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    validateLoginInput(req.body);

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    await assertLoginNotLocked(normalizedEmail);

    const [rows] = await pool.execute(
      `SELECT id, email, password_hash, first_name, last_name, role, token_version
       FROM users
       WHERE email = ? AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      await recordFailedLogin(normalizedEmail, req);
      throw new AppError("Invalid email or password", 401);
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      await recordFailedLogin(normalizedEmail, req);
      throw new AppError("Invalid email or password", 401);
    }

    await resetLoginAttempts(normalizedEmail);
    // Never send password_hash back to the frontend.
    delete user.password_hash;
    const token = signToken(user);
    delete user.token_version;
    setAuthCookie(res, token);

    res.json({
      message: "Logged in successfully",
      token,
      user
    });
    logger.audit("user_logged_in", req, {
      targetUserId: user.id,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await pool.execute(
      "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
      [req.user.id]
    );

    clearAuthCookie(res);
    res.json({
      message: "Logged out successfully"
    });
    logger.audit("user_logged_out", req);
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json({
    user: req.user
  });
}

module.exports = {
  register,
  login,
  logout,
  me
};
