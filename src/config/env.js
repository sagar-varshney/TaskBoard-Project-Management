require("dotenv").config();

const packageJson = require("../../package.json");

function readNumber(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function readEnum(name, allowedValues, fallback) {
  const value = (process.env[name] || fallback).toLowerCase();

  if (!allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(", ")}`);
  }

  return value;
}

function readList(name, fallbackValues = []) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValues;
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireValue(name, options = {}) {
  const value = process.env[name];

  if (!value || (options.rejectPlaceholder && value.includes("replace_this"))) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const storageProvider = readEnum("STORAGE_PROVIDER", ["local", "r2"], "local");
const corsOrigins = readList("CORS_ORIGINS", [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001"
].filter(Boolean));

if (isProduction) {
  requireValue("JWT_SECRET", { rejectPlaceholder: true });
  requireValue("DB_HOST");
  requireValue("DB_USER");
  requireValue("DB_NAME");
}

if (storageProvider === "r2") {
  ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].forEach((name) =>
    requireValue(name)
  );
}

const config = {
  app: {
    name: "TaskBoard API",
    version: packageJson.version,
    environment: nodeEnv,
    isProduction,
    port: readNumber("PORT", 5001),
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    publicUrl: process.env.BACKEND_URL || null
  },
  cors: {
    origins: corsOrigins
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: readNumber("DB_PORT", 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "jira_clone"
  },
  jwt: {
    secret: process.env.JWT_SECRET || "development_only_change_me",
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    groqApiKey: process.env.GROQ_API_KEY || "",
    groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-20b"
  },
  storage: {
    provider: storageProvider,
    localUploadRoot: process.env.LOCAL_UPLOAD_ROOT || "uploads/tickets",
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || "",
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      bucket: process.env.R2_BUCKET || ""
    }
  },
  logging: {
    directory: process.env.LOG_DIR || "logs",
    toConsole: process.env.LOG_TO_CONSOLE !== "false",
    includeRequestBody: process.env.LOG_REQUEST_BODY === "true"
  }
};

function internalApiBaseUrl() {
  return config.app.publicUrl || `http://127.0.0.1:${config.app.port}`;
}

module.exports = {
  config,
  internalApiBaseUrl
};
