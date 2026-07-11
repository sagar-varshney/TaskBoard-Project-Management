const mysql = require("mysql2/promise");
const { config } = require("./env");

const sslOptions = config.db.ssl
  ? {
      rejectUnauthorized: config.db.sslRejectUnauthorized,
      ...(config.db.sslCa ? { ca: config.db.sslCa.replace(/\\n/g, "\n") } : {})
    }
  : undefined;

// A connection pool reuses MySQL connections instead of opening a new one per request.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  ssl: sslOptions,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testDatabaseConnection() {
  // getConnection() proves credentials, host, port, and database name are correct.
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    console.log("Connected to MySQL database");
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testDatabaseConnection
};
