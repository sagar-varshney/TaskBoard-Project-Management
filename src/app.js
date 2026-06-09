require("dotenv").config();

const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/auth.routes");
const issueRoutes = require("./routes/issue.routes");
const projectRoutes = require("./routes/project.routes");
const sprintRoutes = require("./routes/sprint.routes");
const teamRoutes = require("./routes/team.routes");
const ticketRoutes = require("./routes/ticket.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

// Allows the Next.js frontend to call this API from a different port during development.
app.use(cors());
// Parses JSON request bodies so controllers can read req.body.
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Route groups keep each feature area separate: auth, projects, tickets, teams, etc.
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Central error handler: controllers call next(error), and this sends the final JSON response.
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error"
  });
});

module.exports = app;
