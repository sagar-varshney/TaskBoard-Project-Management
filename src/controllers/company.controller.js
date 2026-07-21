const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { ensureTenantSchema } = require("../config/tenant-schema");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

function normalizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validateCompanyAdmin(body) {
  const companyName = String(body.companyName || body.name || "").trim();
  const slug = normalizeSlug(body.slug || companyName);
  const admin = body.admin || {};
  const email = String(admin.email || "").toLowerCase().trim();
  const firstName = String(admin.firstName || admin.first_name || "").trim();
  const lastName = String(admin.lastName || admin.last_name || "").trim();
  const password = String(admin.password || "");

  if (!companyName) {
    throw new AppError("companyName is required", 400);
  }

  if (!slug) {
    throw new AppError("A valid company slug is required", 400);
  }

  if (!email || !email.includes("@")) {
    throw new AppError("Company admin needs a valid email", 400);
  }

  if (!firstName || !lastName) {
    throw new AppError("Company admin needs firstName and lastName", 400);
  }

  if (password.length < 8) {
    throw new AppError("Company admin password must be at least 8 characters", 400);
  }

  return {
    companyName,
    slug,
    admin: {
      email,
      firstName,
      lastName,
      password
    }
  };
}

async function createCompanyWithAdmin(req, res, next) {
  try {
    await ensureTenantSchema();
    const input = validateCompanyAdmin(req.body);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingUsers] = await connection.execute(
        "SELECT id FROM users WHERE email = ?",
        [input.admin.email]
      );

      if (existingUsers.length > 0) {
        throw new AppError("Company admin email is already registered", 409);
      }

      const [companyResult] = await connection.execute(
        "INSERT INTO companies (name, slug) VALUES (?, ?)",
        [input.companyName, input.slug]
      );
      const companyId = companyResult.insertId;
      const passwordHash = await bcrypt.hash(input.admin.password, 12);
      const [adminResult] = await connection.execute(
        `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
         VALUES (?, ?, ?, ?, ?, 'admin')`,
        [
          companyId,
          input.admin.email,
          passwordHash,
          input.admin.firstName,
          input.admin.lastName
        ]
      );

      await connection.commit();
      logger.audit("company_created", req, {
        companyId,
        companyName: input.companyName,
        adminUserId: adminResult.insertId
      });

      res.status(201).json({
        message: "Company workspace created successfully",
        company: {
          id: companyId,
          name: input.companyName,
          slug: input.slug
        },
        admin: {
          id: adminResult.insertId,
          company_id: companyId,
          email: input.admin.email,
          first_name: input.admin.firstName,
          last_name: input.admin.lastName,
          role: "admin"
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(new AppError("Company slug or admin email already exists", 409));
      return;
    }

    next(error);
  }
}

module.exports = {
  createCompanyWithAdmin
};
