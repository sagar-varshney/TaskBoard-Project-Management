const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

function requireCompany(req) {
  if (!req.user?.company_id) {
    throw new AppError("Your account is not assigned to a company workspace", 403);
  }

  return req.user.company_id;
}

async function listProjects(req, res, next) {
  try {
    const companyId = requireCompany(req);
    // Every authenticated user can see projects so they can create/view tickets.
    const [projects] = await pool.execute(
      `SELECT id, company_id, project_key, name, description, owner_id, created_at, updated_at
       FROM projects
       WHERE company_id = ?
       ORDER BY created_at DESC`,
      [companyId]
    );

    res.json({ projects });
  } catch (error) {
    next(error);
  }
}

async function createProject(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const { key, name, description } = req.body;

    if (!key || !name) {
      throw new AppError("Project key and name are required", 400);
    }

    // Project keys are used to create readable ticket keys like PAY-12.
    const projectKey = key.toUpperCase().trim();

    const [result] = await pool.execute(
      "INSERT INTO projects (company_id, project_key, name, description, owner_id) VALUES (?, ?, ?, ?, ?)",
      [companyId, projectKey, name.trim(), description || null, req.user.id]
    );

    res.status(201).json({
      project: {
        id: result.insertId,
        company_id: companyId,
        project_key: projectKey,
        name: name.trim(),
        description: description || null,
        owner_id: req.user.id
      }
    });
    logger.audit("project_created", req, {
      projectId: result.insertId,
      projectKey,
      name: name.trim()
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(new AppError("Project key already exists", 409));
      return;
    }

    next(error);
  }
}

module.exports = {
  listProjects,
  createProject
};
