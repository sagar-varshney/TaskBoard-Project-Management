const AppError = require("../utils/app-error");
const logger = require("../utils/logger");

const stores = new Map();

function clientKey(req, scope) {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : "";
  return [scope, req.ip || "unknown-ip", email].filter(Boolean).join(":");
}

function rateLimit({ scope, maxRequests, windowMs }) {
  if (!stores.has(scope)) {
    stores.set(scope, new Map());
  }

  const store = stores.get(scope);

  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req, scope);
    const current = store.get(key);

    if (!current || current.expiresAt <= now) {
      store.set(key, {
        count: 1,
        expiresAt: now + windowMs
      });
      next();
      return;
    }

    current.count += 1;

    if (current.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((current.expiresAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      logger.warn("rate_limit_exceeded", {
        requestId: req.requestId,
        scope,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        retryAfterSeconds
      });
      next(new AppError("Too many requests. Please try again later.", 429));
      return;
    }

    next();
  };
}

module.exports = {
  rateLimit
};
