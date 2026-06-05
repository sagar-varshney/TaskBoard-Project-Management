const { pool } = require("../config/db");

async function listUsers(req, res, next) {
  try {
    const [users] = await pool.execute(
      `SELECT id, email, first_name, last_name, role
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY first_name ASC, last_name ASC`
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers
};
