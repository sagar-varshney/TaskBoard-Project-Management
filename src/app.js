require("dotenv").config();

const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/auth.routes");
const issueRoutes = require("./routes/issue.routes");
const projectRoutes = require("./routes/project.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/issues", issueRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error"
  });
});

module.exports = app;
