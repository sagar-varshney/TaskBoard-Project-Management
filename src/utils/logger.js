const fs = require("fs/promises");
const path = require("path");
const { config } = require("../config/env");

const logDirectory = path.isAbsolute(config.logging.directory)
  ? config.logging.directory
  : path.join(process.cwd(), config.logging.directory);
const logToConsole = config.logging.toConsole;
const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "jwt",
  "secret",
  "apiKey",
  "api_key",
  "accessKeyId",
  "secretAccessKey"
]);
const securityEvents = new Set([
  "cors_origin_blocked",
  "csrf_validation_failed",
  "login_failed",
  "rate_limit_exceeded",
  "unauthorized_api_attempt",
  "user_blocked",
  "user_unblocked"
]);
const eventSummaries = {
  agent_chat_queried: "AI assistant request audited",
  api_error: "Backend API error captured",
  api_request_completed: "Backend API request completed",
  api_route_not_found: "Unknown backend route requested",
  attachment_analyzed: "Attachment AI analysis completed",
  attachment_comment_added: "Attachment comment added",
  attachment_deleted: "Attachment deleted",
  attachment_upload_presigned: "Direct attachment upload prepared",
  attachment_uploaded: "Attachment uploaded",
  cors_origin_blocked: "Blocked request from non-whitelisted origin",
  csrf_validation_failed: "Blocked cookie-based write without valid CSRF token",
  issue_comment_added: "Ticket comment added",
  issue_comment_deleted: "Ticket comment deleted",
  issue_comment_updated: "Ticket comment updated",
  issue_created: "Ticket created",
  issue_updated: "Ticket updated",
  login_failed: "Failed login attempt recorded",
  log_write_failed: "Log file write failed",
  project_created: "Project created",
  rate_limit_exceeded: "Rate limit blocked excessive requests",
  scrum_team_created: "Scrum team created",
  server_start_failed: "Backend server failed to start",
  server_started: "Backend server started",
  sprint_created: "Sprint created",
  unauthorized_api_attempt: "Blocked request without login credentials",
  user_blocked: "Admin blocked a user and revoked tokens",
  user_logged_in: "User logged in successfully",
  user_logged_out: "User logged out and token was revoked",
  user_registered: "User registered",
  user_unblocked: "Admin unblocked a user"
};

function categoryFor(event, fileName) {
  if (fileName === "error.log") {
    return "error";
  }

  if (securityEvents.has(event)) {
    return "security";
  }

  if (fileName === "audit.log") {
    return "audit";
  }

  return "app";
}

function severityFor(level, event) {
  if (level === "error") {
    return "error";
  }

  if (securityEvents.has(event) || level === "warn") {
    return "warning";
  }

  return "info";
}

function summaryFor(event) {
  return eventSummaries[event] || event.replaceAll("_", " ");
}

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeys.has(key) || sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(item)
      ])
    );
  }

  return value;
}

function contextFromRequest(req) {
  if (!req) {
    return {};
  }

  return {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip
  };
}

async function appendLog(fileName, entry) {
  try {
    await fs.mkdir(logDirectory, { recursive: true });
    await fs.appendFile(path.join(logDirectory, fileName), `${JSON.stringify(entry)}\n`);
  } catch (error) {
    if (logToConsole) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        category: "error",
        severity: "error",
        logFile: "error.log",
        event: "log_write_failed",
        summary: summaryFor("log_write_failed"),
        targetLogFile: fileName,
        logDirectory,
        message: error.message
      }));
    }
  }
}

function writeLog(level, event, details = {}, fileName = "app.log") {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category: categoryFor(event, fileName),
    severity: severityFor(level, event),
    logFile: fileName,
    event,
    summary: summaryFor(event),
    ...sanitize(details)
  };

  if (logToConsole) {
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  appendLog(fileName, entry);
  return entry;
}

function info(event, details = {}) {
  return writeLog("info", event, details);
}

function warn(event, details = {}) {
  return writeLog("warn", event, details);
}

function error(event, details = {}) {
  return writeLog("error", event, details, "error.log");
}

function audit(event, req, details = {}) {
  return writeLog("info", event, {
    ...contextFromRequest(req),
    ...details
  }, "audit.log");
}

function logError(errorValue, req, details = {}) {
  return error("api_error", {
    ...contextFromRequest(req),
    ...details,
    statusCode: errorValue.statusCode || 500,
    errorName: errorValue.name,
    errorCode: errorValue.code,
    message: errorValue.message,
    stack: config.app.isProduction ? undefined : errorValue.stack
  });
}

module.exports = {
  audit,
  error,
  info,
  logError,
  sanitize,
  warn
};
