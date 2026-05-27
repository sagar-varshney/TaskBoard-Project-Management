const { pool } = require("../config/db");
const AppError = require("../utils/app-error");

async function listIssues(req, res, next) {
  try {
    const values = [];
    let whereClause = "";

    if (req.query.projectId) {
      whereClause = "WHERE i.project_id = ?";
      values.push(req.query.projectId);
    }

    const [issues] = await pool.execute(
      `SELECT
         i.id, i.project_id, i.reporter_id, i.assignee_id, i.title, i.description,
         i.issue_type, i.status, i.priority, i.created_at, i.updated_at,
         p.project_key,
         reporter.email AS reporter_email,
         assignee.email AS assignee_email
       FROM issues i
       JOIN projects p ON p.id = i.project_id
       JOIN users reporter ON reporter.id = i.reporter_id
       LEFT JOIN users assignee ON assignee.id = i.assignee_id
       ${whereClause}
       ORDER BY i.created_at DESC`,
      values
    );

    res.json({ issues });
  } catch (error) {
    next(error);
  }
}

async function createIssue(req, res, next) {
  try {
    const {
      projectId,
      assigneeId,
      title,
      description,
      issueType = "task",
      priority = "medium"
    } = req.body;

    if (!projectId || !title) {
      throw new AppError("projectId and title are required", 400);
    }

    const [result] = await pool.execute(
      `INSERT INTO issues
         (project_id, reporter_id, assignee_id, title, description, issue_type, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        req.user.id,
        assigneeId || null,
        title.trim(),
        description || null,
        issueType,
        priority
      ]
    );

    res.status(201).json({
      issue: {
        id: result.insertId,
        project_id: projectId,
        reporter_id: req.user.id,
        assignee_id: assigneeId || null,
        title: title.trim(),
        description: description || null,
        issue_type: issueType,
        status: "todo",
        priority
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateIssueStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowedStatuses = ["todo", "in_progress", "done"];

    if (!allowedStatuses.includes(status)) {
      throw new AppError("Status must be todo, in_progress or done", 400);
    }

    const [result] = await pool.execute(
      "UPDATE issues SET status = ? WHERE id = ?",
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      throw new AppError("Issue not found", 404);
    }

    res.json({
      message: "Issue status updated",
      issue: {
        id: Number(req.params.id),
        status
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listIssues,
  createIssue,
  updateIssueStatus
};
