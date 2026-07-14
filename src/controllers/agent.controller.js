const AppError = require("../utils/app-error");
const logger = require("../utils/logger");
const { runAgent } = require("../services/agent.service");

async function chat(req, res, next) {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      throw new AppError("message is required", 400);
    }

    if (message.trim().length > 1000) {
      throw new AppError("message must be 1000 characters or fewer", 400);
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
          .map((item) => ({ ...item, content: item.content.slice(0, 1000) }))
          .slice(-8)
      : [];
    const state = await runAgent({
      message: message.trim(),
      history: safeHistory,
      user: req.user,
      authorization: req.headers.authorization
    });
    logger.audit("agent_chat_queried", req, {
      action: state.plan.tool,
      changed: Boolean(state.changed),
      messageLength: message.trim().length,
      historyLength: safeHistory.length
    });

    res.json({
      reply: state.reply,
      action: state.plan.tool,
      changed: Boolean(state.changed)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  chat
};
