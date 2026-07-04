const crypto = require("crypto");
const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const shouldLogBody =
      req.method !== "GET" &&
      (res.statusCode >= 400 || process.env.LOG_REQUEST_BODY === "true");

    logger.info("api_request_completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      body: shouldLogBody ? req.body : undefined
    });
  });

  next();
}

module.exports = {
  requestLogger
};
