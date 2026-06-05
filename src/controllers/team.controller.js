const { pool } = require("../config/db");
const AppError = require("../utils/app-error");

async function listTeams(req, res, next) {
  try {
    const values = [];
    const filters = [];

    if (req.query.projectId) {
      filters.push("t.project_id = ?");
      values.push(req.query.projectId);
    }

    const [teams] = await pool.execute(
      `SELECT
         t.id, t.project_id, t.name, t.description, t.created_at, t.updated_at,
         COUNT(m.user_id) AS member_count
       FROM scrum_teams t
       LEFT JOIN scrum_team_members m ON m.team_id = t.id
       ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
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
    const { projectId, name, description, memberIds = [] } = req.body;

    if (!projectId || !name) {
      throw new AppError("projectId and name are required", 400);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        "INSERT INTO scrum_teams (project_id, name, description) VALUES (?, ?, ?)",
        [projectId, name.trim(), description || null]
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
          project_id: projectId,
          name: name.trim(),
          description: description || null,
          member_count: memberIds.length
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
