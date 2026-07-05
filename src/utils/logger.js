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
      console.error("Failed to write log entry:", error.message);
    }
  }
}

function writeLog(level, event, details = {}, fileName = "app.log") {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
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
