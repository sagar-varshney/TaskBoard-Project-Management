const cors = require("cors");
const express = require("express");
const agentRoutes = require("./routes/agent.routes");
const authRoutes = require("./routes/auth.routes");
const { config } = require("./config/env");
const { getApiDocsHtml, getOpenApiDocument } = require("./docs/openapi");
const issueRoutes = require("./routes/issue.routes");
const { requestLogger } = require("./middleware/request-logger.middleware");
const projectRoutes = require("./routes/project.routes");
const sprintRoutes = require("./routes/sprint.routes");
const teamRoutes = require("./routes/team.routes");
const ticketRoutes = require("./routes/ticket.routes");
const userRoutes = require("./routes/user.routes");
const logger = require("./utils/logger");

const app = express();

// Allows only configured frontend origins to call the API across domains.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.cors.origins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
  })
);
// Adds a request ID and structured request/response logging for API observability.
app.use(requestLogger);
// Parses JSON request bodies so controllers can read req.body.
// File uploads use multipart/form-data, so JSON bodies can stay relatively small.
app.use(express.json({ limit: "2mb" }));

function getApiIndex() {
  return {
    status: "ok",
    service: config.app.name,
    message: "TaskBoard API is running",
    documentation: "/api/docs",
    health: "/api/health",
    openapi: "/api/openapi.json"
  };
}

app.get("/", (req, res) => {
  res.json(getApiIndex());
});

app.get("/api", (req, res) => {
  res.json(getApiIndex());
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: config.app.name,
    version: config.app.version,
    environment: config.app.environment,
    storageProvider: config.storage.provider,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/openapi.json", (req, res) => {
  res.json(getOpenApiDocument());
});

app.get("/api/docs", (req, res) => {
  res.type("html").send(getApiDocsHtml());
});

// Route groups keep each feature area separate: auth, projects, tickets, teams, etc.
app.use("/api/agent", agentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  logger.warn("api_route_not_found", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    userRole: req.user?.role
  });
  res.status(404).json({ message: "Route not found" });
});

// Central error handler: controllers call next(error), and this sends the final JSON response.
app.use((error, req, res, next) => {
  logger.logError(error, req);

  if (error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({
      message: "Attachment must be between 1 byte and 8MB"
    });
    return;
  }

  res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error"
  });
});

module.exports = app;
