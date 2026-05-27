const { pool } = require("../config/db");
const AppError = require("../utils/app-error");

async function listProjects(req, res, next) {
  try {
    const [projects] = await pool.execute(
      `SELECT id, project_key, name, description, owner_id, created_at, updated_at
       FROM projects
       ORDER BY created_at DESC`
    );

    res.json({ projects });
  } catch (error) {
    next(error);
  }
}

async function createProject(req, res, next) {
  try {
    const { key, name, description } = req.body;

    if (!key || !name) {
      throw new AppError("Project key and name are required", 400);
    }

    const projectKey = key.toUpperCase().trim();

    const [result] = await pool.execute(
      "INSERT INTO projects (project_key, name, description, owner_id) VALUES (?, ?, ?, ?)",
      [projectKey, name.trim(), description || null, req.user.id]
    );

    res.status(201).json({
      project: {
        id: result.insertId,
        project_key: projectKey,
        name: name.trim(),
        description: description || null,
        owner_id: req.user.id
      }
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
