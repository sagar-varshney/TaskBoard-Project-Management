const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const { summarizeTicket } = require("../services/gemini.service");

const allowedIssueTypes = ["bug", "task", "story"];
const allowedPriorities = ["low", "medium", "high", "critical"];
const allowedStatuses = ["todo", "in_progress", "done"];

const ticketSelect = `
  SELECT
    i.id, i.project_id, i.reporter_id, i.assignee_id, i.title, i.description,
    i.issue_type, i.status, i.priority, i.created_at, i.updated_at,
    p.project_key,
    CONCAT(p.project_key, '-', i.id) AS ticket_key,
    reporter.email AS reporter_email,
    assignee.email AS assignee_email
  FROM issues i
  JOIN projects p ON p.id = i.project_id
  JOIN users reporter ON reporter.id = i.reporter_id
  LEFT JOIN users assignee ON assignee.id = i.assignee_id
`;

function validateOption(value, allowedValues, fieldName) {
  if (value !== undefined && !allowedValues.includes(value)) {
    throw new AppError(`${fieldName} must be one of: ${allowedValues.join(", ")}`, 400);
  }
}

async function findTicket(id) {
  const [rows] = await pool.execute(
    `${ticketSelect}
     WHERE i.id = ?`,
    [id]
  );

  return rows[0];
}

async function listIssues(req, res, next) {
  try {
    const values = [];
    const filters = [];

    if (req.query.projectId) {
      filters.push("i.project_id = ?");
      values.push(req.query.projectId);
    }

    if (req.query.status) {
      validateOption(req.query.status, allowedStatuses, "status");
      filters.push("i.status = ?");
      values.push(req.query.status);
    }

    const [tickets] = await pool.execute(
      `${ticketSelect}
       ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY i.created_at DESC`,
      values
    );

    res.json({ tickets });
  } catch (error) {
    next(error);
  }
}

async function getIssue(req, res, next) {
  try {
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    res.json({ ticket });
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

    validateOption(issueType, allowedIssueTypes, "issueType");
    validateOption(priority, allowedPriorities, "priority");

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

    const ticket = await findTicket(result.insertId);
    res.status(201).json({ ticket });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      next(new AppError("Project or assignee does not exist", 400));
      return;
    }

    next(error);
  }
}

async function updateIssue(req, res, next) {
  try {
    const fields = [];
    const values = [];
    const {
      assigneeId,
      title,
      description,
      issueType,
      status,
      priority
    } = req.body;

    validateOption(issueType, allowedIssueTypes, "issueType");
    validateOption(status, allowedStatuses, "status");
    validateOption(priority, allowedPriorities, "priority");

    if (title !== undefined) {
      if (!title.trim()) {
        throw new AppError("title cannot be empty", 400);
      }

      fields.push("title = ?");
      values.push(title.trim());
    }

    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description || null);
    }

    if (assigneeId !== undefined) {
      fields.push("assignee_id = ?");
      values.push(assigneeId || null);
    }

    if (issueType !== undefined) {
      fields.push("issue_type = ?");
      values.push(issueType);
    }

    if (status !== undefined) {
      fields.push("status = ?");
      values.push(status);
    }

    if (priority !== undefined) {
      fields.push("priority = ?");
      values.push(priority);
    }

    if (fields.length === 0) {
      throw new AppError("Provide at least one ticket field to update", 400);
    }

    values.push(req.params.id);
    const [result] = await pool.execute(
      `UPDATE issues
       SET ${fields.join(", ")}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      throw new AppError("Ticket not found", 404);
    }

    const ticket = await findTicket(req.params.id);
    res.json({
      message: "Ticket updated",
      ticket
    });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      next(new AppError("Assignee does not exist", 400));
      return;
    }

    next(error);
  }
}

async function updateIssueStatus(req, res, next) {
  req.body = { status: req.body.status };
  updateIssue(req, res, next);
}

async function createIssueSummary(req, res, next) {
  try {
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const insight = await summarizeTicket(ticket);
    res.json({
      ticket_id: ticket.id,
      ticket_key: ticket.ticket_key,
      insight
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  updateIssueStatus,
  createIssueSummary
};
