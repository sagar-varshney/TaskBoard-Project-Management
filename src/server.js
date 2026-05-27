const app = require("./app");
const { testDatabaseConnection } = require("./config/db");

const port = process.env.PORT || 5000;

async function startServer() {
  await testDatabaseConnection();

  app.listen(port, () => {
    console.log(`JIRA clone API is running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
