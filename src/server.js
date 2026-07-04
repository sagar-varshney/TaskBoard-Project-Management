const app = require("./app");
const { testDatabaseConnection } = require("./config/db");
const logger = require("./utils/logger");

const port = process.env.PORT || 5000;

async function startServer() {
  // The API should not start unless MySQL is reachable, because most routes depend on the database.
  await testDatabaseConnection();

  app.listen(port, () => {
    logger.info("server_started", { port: Number(port) });
  });
}

startServer().catch((error) => {
  logger.error("server_start_failed", {
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
  process.exit(1);
});
