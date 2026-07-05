const app = require("./app");
const { testDatabaseConnection } = require("./config/db");
const { config } = require("./config/env");
const logger = require("./utils/logger");

async function startServer() {
  // The API should not start unless MySQL is reachable, because most routes depend on the database.
  await testDatabaseConnection();

  app.listen(config.app.port, () => {
    logger.info("server_started", {
      port: config.app.port,
      environment: config.app.environment,
      corsOrigins: config.cors.origins
    });
  });
}

startServer().catch((error) => {
  logger.error("server_start_failed", {
    message: error.message,
    stack: config.app.isProduction ? undefined : error.stack
  });
  process.exit(1);
});
