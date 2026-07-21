const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

const allowedEmployeeRoles = new Set(["member", "developer", "admin"]);

function requireCompany(req) {
  if (!req.user?.company_id) {
    throw new AppError("Your account is not assigned to a company workspace", 403);
  }

  return req.user.company_id;
}

function normalizeEmployeeInput(employee) {
  const email = String(employee.email || "").toLowerCase().trim();
  const firstName = String(employee.firstName || employee.first_name || "").trim();
  const lastName = String(employee.lastName || employee.last_name || "").trim();
  const password = String(employee.password || "");
  const role = employee.role || "member";

  if (!email || !email.includes("@")) {
    throw new AppError("Each employee needs a valid email", 400);
  }

  if (!firstName || !lastName) {
    throw new AppError("Each employee needs a firstName and lastName", 400);
  }

  if (password.length < 8) {
    throw new AppError("Each employee password must be at least 8 characters", 400);
  }

  if (!allowedEmployeeRoles.has(role)) {
    throw new AppError("Employee role must be member, developer, or admin", 400);
  }

  return {
    email,
    firstName,
    lastName,
    password,
    role
  };
}

async function listUsers(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const [users] = await pool.execute(
      `SELECT id, company_id, email, first_name, last_name, role
       FROM users
       WHERE company_id = ? AND deleted_at IS NULL
       ORDER BY first_name ASC, last_name ASC`,
      [companyId]
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function listBlockedUsers(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const [users] = await pool.execute(
      `SELECT id, company_id, email, first_name, last_name, role, deleted_at
       FROM users
       WHERE company_id = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [companyId]
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function listAssignableUsers(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const [users] = await pool.execute(
      `SELECT id, first_name, last_name, role
       FROM users
       WHERE company_id = ? AND deleted_at IS NULL
       ORDER BY first_name ASC, last_name ASC`,
      [companyId]
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    const companyId = requireCompany(req);
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
       WHERE id = ? AND company_id = ?`,
      [userId, companyId]
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
    const companyId = requireCompany(req);
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("A valid user id is required", 400);
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET deleted_at = NULL,
           token_version = token_version + 1
       WHERE id = ? AND company_id = ?`,
      [userId, companyId]
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

async function createEmployee(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const employee = normalizeEmployeeInput(req.body);

    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [employee.email]
    );

    if (existingUsers.length > 0) {
      throw new AppError("Email is already registered", 409);
    }

    const passwordHash = await bcrypt.hash(employee.password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        employee.email,
        passwordHash,
        employee.firstName,
        employee.lastName,
        employee.role
      ]
    );

    logger.audit("employee_created", req, {
      targetUserId: result.insertId,
      companyId,
      email: employee.email,
      role: employee.role
    });

    res.status(201).json({
      message: "Employee created successfully",
      user: {
        id: result.insertId,
        company_id: companyId,
        email: employee.email,
        first_name: employee.firstName,
        last_name: employee.lastName,
        role: employee.role
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(new AppError("Email is already registered", 409));
      return;
    }

    next(error);
  }
}

async function createEmployeesBulk(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const employees = Array.isArray(req.body.employees) ? req.body.employees : [];

    if (employees.length === 0) {
      throw new AppError("employees must contain at least one employee", 400);
    }

    if (employees.length > 50) {
      throw new AppError("You can add up to 50 employees at once", 400);
    }

    const normalizedEmployees = employees.map(normalizeEmployeeInput);
    const seenEmails = new Set();

    for (const employee of normalizedEmployees) {
      if (seenEmails.has(employee.email)) {
        throw new AppError(`Duplicate email in request: ${employee.email}`, 400);
      }

      seenEmails.add(employee.email);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const createdUsers = [];
      const skippedUsers = [];

      for (const employee of normalizedEmployees) {
        const [existingUsers] = await connection.execute(
          "SELECT id FROM users WHERE email = ?",
          [employee.email]
        );

        if (existingUsers.length > 0) {
          skippedUsers.push({
            email: employee.email,
            reason: "Email is already registered"
          });
          continue;
        }

        const passwordHash = await bcrypt.hash(employee.password, 12);
        const [result] = await connection.execute(
          `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            employee.email,
            passwordHash,
            employee.firstName,
            employee.lastName,
            employee.role
          ]
        );

        createdUsers.push({
          id: result.insertId,
          company_id: companyId,
          email: employee.email,
          first_name: employee.firstName,
          last_name: employee.lastName,
          role: employee.role
        });
      }

      await connection.commit();
      logger.audit("employees_bulk_created", req, {
        companyId,
        createdCount: createdUsers.length,
        skippedCount: skippedUsers.length
      });

      res.status(201).json({
        message: "Bulk employee import completed",
        createdUsers,
        skippedUsers
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const userId = Number(req.params.id);
    const { role } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("A valid user id is required", 400);
    }

    if (!allowedEmployeeRoles.has(role)) {
      throw new AppError("role must be member, developer, or admin", 400);
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET role = ?, token_version = token_version + 1
       WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
      [role, userId, companyId]
    );

    if (result.affectedRows === 0) {
      throw new AppError("User not found", 404);
    }

    logger.audit("user_role_updated", req, {
      targetUserId: userId,
      companyId,
      role
    });

    res.json({ message: "User role updated successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  blockUser,
  createEmployee,
  createEmployeesBulk,
  listAssignableUsers,
  listBlockedUsers,
  listUsers,
  unblockUser,
  updateUserRole
};
