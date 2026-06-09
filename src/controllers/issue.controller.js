const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const { summarizeTicket } = require("../services/gemini.service");

const allowedIssueTypes = ["bug", "task", "story"];
const allowedPriorities = ["low", "medium", "high", "critical"];
const allowedStatuses = ["todo", "in_progress", "done"];
const allowedResolutions = ["unresolved", "fixed", "wont_fix", "duplicate"];

// Non-admin users may only change these work-progress fields.
const workEditableFields = ["status", "resolution", "fixPlan"];

// Maps database column names to request body field names for activity/audit logging.
const activityFields = [
  ["title", "title"],
  ["issue_type", "issueType"],
  ["status", "status"],
  ["priority", "priority"],
  ["resolution", "resolution"],
  ["sprint_id", "sprintId"],
  ["scrum_team_id", "scrumTeamId"],
  ["assignee_id", "assigneeId"],
  ["owner_id", "ownerId"],
  ["impact", "impact"],
  ["fix_plan", "fixPlan"],
  ["description", "description"]
];

const ticketSelect = `
  -- Shared ticket query used by list/get/update responses.
  -- It joins related tables so the frontend receives readable names/emails, not just IDs.
  SELECT
    i.id, i.project_id, i.reporter_id, i.assignee_id, i.owner_id, i.sprint_id,
    i.scrum_team_id, i.title, i.description,
    i.issue_type, i.status, i.priority, i.resolution, i.sprint, i.scrum_team,
    i.impact, i.fix_plan, i.created_at, i.updated_at,
    p.project_key,
    CONCAT(p.project_key, '-', i.id) AS ticket_key,
    sprint.name AS sprint_name,
    team.name AS scrum_team_name,
    reporter.email AS reporter_email,
    assignee.email AS assignee_email,
    owner.email AS owner_email
  FROM issues i
  JOIN projects p ON p.id = i.project_id
  JOIN users reporter ON reporter.id = i.reporter_id
  LEFT JOIN users assignee ON assignee.id = i.assignee_id
  LEFT JOIN users owner ON owner.id = i.owner_id
  LEFT JOIN sprints sprint ON sprint.id = i.sprint_id
  LEFT JOIN scrum_teams team ON team.id = i.scrum_team_id
`;

function validateOption(value, allowedValues, fieldName) {
  // Keeps incoming API values aligned with the ENUM values in MySQL.
  if (value !== undefined && !allowedValues.includes(value)) {
    throw new AppError(`${fieldName} must be one of: ${allowedValues.join(", ")}`, 400);
  }
}

async function findTicket(id) {
  // Single source for fetching a ticket with all joined display fields.
  const [rows] = await pool.execute(
    `${ticketSelect}
     WHERE i.id = ?`,
    [id]
  );

  return rows[0];
}

function normalizeActivityValue(value) {
  // Audit values are stored as TEXT. Empty/unknown values become NULL for cleaner history.
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value);
}

async function logIssueActivity(issueId, actorId, action, fieldName = null, oldValue = null, newValue = null) {
  // Inserts one audit event into issue_activity.
  await pool.execute(
    `INSERT INTO issue_activity (issue_id, actor_id, action, field_name, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      issueId,
      actorId,
      action,
      fieldName,
      normalizeActivityValue(oldValue),
      normalizeActivityValue(newValue)
    ]
  );
}

async function logChangedFields(issueId, actorId, beforeTicket, afterTicket, requestBody) {
  // Only log fields that were actually sent in the request and whose values changed.
  for (const [columnName, bodyField] of activityFields) {
    if (requestBody[bodyField] === undefined) {
      continue;
    }

    const beforeValue = normalizeActivityValue(beforeTicket[columnName]);
    const afterValue = normalizeActivityValue(afterTicket[columnName]);

    if (beforeValue !== afterValue) {
      await logIssueActivity(issueId, actorId, "updated_field", columnName, beforeValue, afterValue);
    }
  }
}

async function listIssues(req, res, next) {
  try {
    const values = [];
    const filters = [];

    // These optional query params power filtering on the dashboard.
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

async function listMyIssues(req, res, next) {
  try {
    // Personal queue includes tickets the user reported, owns, or is assigned to.
    const [tickets] = await pool.execute(
      `${ticketSelect}
       WHERE i.assignee_id = ? OR i.owner_id = ? OR i.reporter_id = ?
       ORDER BY i.updated_at DESC`,
      [req.user.id, req.user.id, req.user.id]
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
      ownerId,
      sprintId,
      scrumTeamId,
      title,
      description,
      issueType = "task",
      priority = "medium",
      resolution = "unresolved",
      sprint,
      scrumTeam,
      impact,
      fixPlan
    } = req.body;

    if (!projectId || !title) {
      throw new AppError("projectId and title are required", 400);
    }

    if (
      req.user.role !== "admin" &&
      (assigneeId || ownerId || sprintId || scrumTeamId)
    ) {
      // Members/developers can report tickets, but admins control delegation and planning.
      throw new AppError(
        "Only admins can delegate a new ticket or assign its sprint and scrum team",
        403
      );
    }

    validateOption(issueType, allowedIssueTypes, "issueType");
    validateOption(priority, allowedPriorities, "priority");
    validateOption(resolution, allowedResolutions, "resolution");

    const [result] = await pool.execute(
      `INSERT INTO issues
         (project_id, reporter_id, assignee_id, owner_id, sprint_id, scrum_team_id, title, description, issue_type, priority, resolution, sprint, scrum_team, impact, fix_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        req.user.id,
        assigneeId || null,
        ownerId || req.user.id,
        sprintId || null,
        scrumTeamId || null,
        title.trim(),
        description || null,
        issueType,
        priority,
        resolution,
        sprint || null,
        scrumTeam || null,
        impact || null,
        fixPlan || null
      ]
    );

    const ticket = await findTicket(result.insertId);
    // First audit entry for the ticket.
    await logIssueActivity(ticket.id, req.user.id, "created_ticket");
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
    // Dynamic update: only fields provided in req.body are added to the SQL SET clause.
    const fields = [];
    const values = [];
    const {
      assigneeId,
      ownerId,
      sprintId,
      scrumTeamId,
      title,
      description,
      issueType,
      status,
      priority,
      resolution,
      sprint,
      scrumTeam,
      impact,
      fixPlan
    } = req.body;
    const requestedFields = Object.keys(req.body);
    const existingTicket = await findTicket(req.params.id);

    if (!existingTicket) {
      throw new AppError("Ticket not found", 404);
    }

    if (req.user.role !== "admin") {
      const blockedFields = requestedFields.filter((field) => !workEditableFields.includes(field));
      const isDelegatedUser =
        req.user.role === "developer" ||
        existingTicket.assignee_id === req.user.id ||
        existingTicket.owner_id === req.user.id;

      if (blockedFields.length > 0) {
        // Protects planning fields such as sprint, type, priority, assignee, and owner.
        throw new AppError(
          "Only admins can update ticket metadata such as header, type, priority, sprint, scrum team, impact, and description",
          403
        );
      }

      if (!isDelegatedUser) {
        // Developers can update work globally; members need to be assignee or owner.
        throw new AppError(
          "Only admins, developers, assignees, or owners can update ticket work fields",
          403
        );
      }
    }

    validateOption(issueType, allowedIssueTypes, "issueType");
    validateOption(status, allowedStatuses, "status");
    validateOption(priority, allowedPriorities, "priority");
    validateOption(resolution, allowedResolutions, "resolution");

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

    if (ownerId !== undefined) {
      fields.push("owner_id = ?");
      values.push(ownerId || null);
    }

    if (sprintId !== undefined) {
      fields.push("sprint_id = ?");
      values.push(sprintId || null);
    }

    if (scrumTeamId !== undefined) {
      fields.push("scrum_team_id = ?");
      values.push(scrumTeamId || null);
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

    if (resolution !== undefined) {
      fields.push("resolution = ?");
      values.push(resolution);
    }

    if (sprint !== undefined) {
      fields.push("sprint = ?");
      values.push(sprint || null);
    }

    if (scrumTeam !== undefined) {
      fields.push("scrum_team = ?");
      values.push(scrumTeam || null);
    }

    if (impact !== undefined) {
      fields.push("impact = ?");
      values.push(impact || null);
    }

    if (fixPlan !== undefined) {
      fields.push("fix_plan = ?");
      values.push(fixPlan || null);
    }

    if (fields.length === 0) {
      throw new AppError("Provide at least one ticket field to update", 400);
    }

    values.push(req.params.id);
    // fields.join(", ") produces SQL like: "status = ?, resolution = ?".
    await pool.execute(
      `UPDATE issues
       SET ${fields.join(", ")}
       WHERE id = ?`,
      values
    );

    const ticket = await findTicket(req.params.id);
    // Compare the old/new ticket and write audit records for changed fields.
    await logChangedFields(req.params.id, req.user.id, existingTicket, ticket, req.body);
    res.json({
      message: "Ticket updated",
      ticket
    });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      next(new AppError("Assignee or owner does not exist", 400));
      return;
    }

    next(error);
  }
}

async function listIssueActivity(req, res, next) {
  try {
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const [activity] = await pool.execute(
      // Activity timeline joins users so the UI can show who made each change.
      `SELECT
         a.id, a.issue_id, a.actor_id, a.action, a.field_name, a.old_value,
         a.new_value, a.created_at,
         u.email AS actor_email,
         u.first_name AS actor_first_name,
         u.last_name AS actor_last_name
       FROM issue_activity a
       JOIN users u ON u.id = a.actor_id
       WHERE a.issue_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    res.json({ activity });
  } catch (error) {
    next(error);
  }
}

async function updateIssueStatus(req, res, next) {
  // Backward-compatible helper route that limits the request to status only.
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
    // Returns structured AI output for the frontend insight panel.
    res.json({
      ticket_id: ticket.id,
      ticket_key: ticket.ticket_key,
      insight
    });
  } catch (error) {
    next(error);
  }
}

async function listIssueComments(req, res, next) {
  try {
    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const [comments] = await pool.execute(
      // deleted_at IS NULL implements comment soft delete.
      `SELECT
         c.id, c.issue_id, c.user_id, c.comment_text, c.is_internal, c.created_at, c.updated_at,
         u.email AS author_email,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name
       FROM issue_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.issue_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );

    res.json({ comments });
  } catch (error) {
    next(error);
  }
}

async function createIssueComment(req, res, next) {
  try {
    const { commentText, isInternal = false } = req.body;

    if (!commentText || !commentText.trim()) {
      throw new AppError("commentText is required", 400);
    }

    const ticket = await findTicket(req.params.id);

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const [result] = await pool.execute(
      `INSERT INTO issue_comments (issue_id, user_id, comment_text, is_internal)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, req.user.id, commentText.trim(), Boolean(isInternal)]
    );
    // Comment actions also appear in the audit timeline.
    await logIssueActivity(req.params.id, req.user.id, "added_comment");

    const [comments] = await pool.execute(
      `SELECT
         c.id, c.issue_id, c.user_id, c.comment_text, c.is_internal, c.created_at, c.updated_at,
         u.email AS author_email,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name
       FROM issue_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Comment added",
      comment: comments[0]
    });
  } catch (error) {
    next(error);
  }
}

async function updateIssueComment(req, res, next) {
  try {
    const { commentText, isInternal } = req.body;

    if (!commentText || !commentText.trim()) {
      throw new AppError("commentText is required", 400);
    }

    const [existingComments] = await pool.execute(
      `SELECT id, user_id
       FROM issue_comments
       WHERE id = ? AND issue_id = ? AND deleted_at IS NULL`,
      [req.params.commentId, req.params.id]
    );

    if (existingComments.length === 0) {
      throw new AppError("Comment not found", 404);
    }

    if (req.user.role !== "admin" && existingComments[0].user_id !== req.user.id) {
      // Admins can moderate all comments; normal users can edit only their own.
      throw new AppError("You can only edit your own comments", 403);
    }

    await pool.execute(
      `UPDATE issue_comments
       SET comment_text = ?, is_internal = ?
       WHERE id = ?`,
      [commentText.trim(), Boolean(isInternal), req.params.commentId]
    );
    await logIssueActivity(req.params.id, req.user.id, "edited_comment");

    const [comments] = await pool.execute(
      `SELECT
         c.id, c.issue_id, c.user_id, c.comment_text, c.is_internal, c.created_at, c.updated_at,
         u.email AS author_email,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name
       FROM issue_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [req.params.commentId]
    );

    res.json({
      message: "Comment updated",
      comment: comments[0]
    });
  } catch (error) {
    next(error);
  }
}

async function deleteIssueComment(req, res, next) {
  try {
    const [existingComments] = await pool.execute(
      `SELECT id, user_id
       FROM issue_comments
       WHERE id = ? AND issue_id = ? AND deleted_at IS NULL`,
      [req.params.commentId, req.params.id]
    );

    if (existingComments.length === 0) {
      throw new AppError("Comment not found", 404);
    }

    if (req.user.role !== "admin" && existingComments[0].user_id !== req.user.id) {
      throw new AppError("You can only delete your own comments", 403);
    }

    await pool.execute(
      // Soft delete preserves the comment record but hides it from normal comment lists.
      "UPDATE issue_comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.commentId]
    );
    await logIssueActivity(req.params.id, req.user.id, "deleted_comment");

    res.json({ message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listIssues,
  listMyIssues,
  getIssue,
  createIssue,
  updateIssue,
  updateIssueStatus,
  createIssueSummary,
  listIssueActivity,
  listIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment
};
