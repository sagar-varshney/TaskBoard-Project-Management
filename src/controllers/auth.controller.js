const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { config } = require("../config/env");
const AppError = require("../utils/app-error");
const { signToken } = require("../utils/jwt");
const logger = require("../utils/logger");

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

    const [rows] = await pool.execute(
      `SELECT id, email, password_hash, first_name, last_name, role, token_version
       FROM users
       WHERE email = ? AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      throw new AppError("Invalid email or password", 401);
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw new AppError("Invalid email or password", 401);
    }

    // Never send password_hash back to the frontend.
    delete user.password_hash;
    const token = signToken(user);
    delete user.token_version;

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
