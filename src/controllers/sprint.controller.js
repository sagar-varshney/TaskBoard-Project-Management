const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

const allowedSprintStatuses = ["planned", "active", "completed"];

function requireCompany(req) {
  if (!req.user?.company_id) {
    throw new AppError("Your account is not assigned to a company workspace", 403);
  }

  return req.user.company_id;
}

async function listSprints(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const values = [companyId];
    const filters = ["s.company_id = ?"];

    // Optional filter used by the frontend when showing sprints for one project.
    if (req.query.projectId) {
      filters.push("s.project_id = ?");
      values.push(req.query.projectId);
    }

    const [sprints] = await pool.execute(
      `SELECT s.id, s.company_id, s.project_id, s.name, s.goal, s.start_date, s.end_date, s.status, s.created_at, s.updated_at
       FROM sprints s
       WHERE ${filters.join(" AND ")}
       ORDER BY s.created_at DESC`,
      values
    );

    res.json({ sprints });
  } catch (error) {
    next(error);
  }
}

async function createSprint(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const { projectId, name, goal, startDate, endDate, status = "planned" } = req.body;

    if (!projectId || !name) {
      throw new AppError("projectId and name are required", 400);
    }

    if (!allowedSprintStatuses.includes(status)) {
      throw new AppError(`status must be one of: ${allowedSprintStatuses.join(", ")}`, 400);
    }

    const [projects] = await pool.execute(
      "SELECT id FROM projects WHERE id = ? AND company_id = ?",
      [projectId, companyId]
    );

    if (projects.length === 0) {
      throw new AppError("Project does not exist in your company workspace", 400);
    }

    // Admin-only route in sprint.routes.js; this function only handles validation and insertion.
    const [result] = await pool.execute(
      `INSERT INTO sprints (company_id, project_id, name, goal, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, projectId, name.trim(), goal || null, startDate || null, endDate || null, status]
    );

    res.status(201).json({
      sprint: {
        id: result.insertId,
        company_id: companyId,
        project_id: projectId,
        name: name.trim(),
        goal: goal || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status
      }
    });
    logger.audit("sprint_created", req, {
      sprintId: result.insertId,
      projectId,
      name: name.trim(),
      status
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(new AppError("Sprint already exists for this project", 409));
      return;
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      next(new AppError("Project does not exist", 400));
      return;
    }

    next(error);
  }
}

module.exports = {
  listSprints,
  createSprint
};
