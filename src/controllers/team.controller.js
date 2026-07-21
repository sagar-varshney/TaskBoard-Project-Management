const { pool } = require("../config/db");
const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

function requireCompany(req) {
  if (!req.user?.company_id) {
    throw new AppError("Your account is not assigned to a company workspace", 403);
  }

  return req.user.company_id;
}

async function listTeams(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const values = [companyId];
    const filters = ["t.company_id = ?"];

    if (req.query.projectId) {
      filters.push("t.project_id = ?");
      values.push(req.query.projectId);
    }

    const [teams] = await pool.execute(
      `SELECT
         t.id, t.company_id, t.project_id, t.name, t.description, t.created_at, t.updated_at,
         COUNT(m.user_id) AS member_count
       FROM scrum_teams t
       LEFT JOIN scrum_team_members m ON m.team_id = t.id
       WHERE ${filters.join(" AND ")}
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      values
    );

    res.json({ teams });
  } catch (error) {
    next(error);
  }
}

async function createTeam(req, res, next) {
  try {
    const companyId = requireCompany(req);
    const { projectId, name, description, memberIds = [] } = req.body;

    if (!projectId || !name) {
      throw new AppError("projectId and name are required", 400);
    }

    const connection = await pool.getConnection();

    try {
      // Transaction keeps team creation and member assignment together.
      // If one member insert fails, the whole team creation is rolled back.
      await connection.beginTransaction();
      const [projects] = await connection.execute(
        "SELECT id FROM projects WHERE id = ? AND company_id = ?",
        [projectId, companyId]
      );

      if (projects.length === 0) {
        throw new AppError("Project does not exist in your company workspace", 400);
      }

      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => "?").join(", ");
        const [members] = await connection.execute(
          `SELECT id FROM users
           WHERE company_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
          [companyId, ...memberIds]
        );

        if (members.length !== memberIds.length) {
          throw new AppError("Every team member must belong to your company workspace", 400);
        }
      }

      const [result] = await connection.execute(
        "INSERT INTO scrum_teams (company_id, project_id, name, description) VALUES (?, ?, ?, ?)",
        [companyId, projectId, name.trim(), description || null]
      );

      for (const memberId of memberIds) {
        await connection.execute(
          "INSERT INTO scrum_team_members (team_id, user_id) VALUES (?, ?)",
          [result.insertId, memberId]
        );
      }

      await connection.commit();
      res.status(201).json({
        team: {
          id: result.insertId,
          company_id: companyId,
          project_id: projectId,
          name: name.trim(),
          description: description || null,
          member_count: memberIds.length
        }
      });
      logger.audit("scrum_team_created", req, {
        teamId: result.insertId,
        projectId,
        name: name.trim(),
        memberCount: memberIds.length
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(new AppError("Scrum team already exists for this project", 409));
      return;
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      next(new AppError("Project or member does not exist", 400));
      return;
    }

    next(error);
  }
}

module.exports = {
  listTeams,
  createTeam
};
