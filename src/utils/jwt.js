const jwt = require("jsonwebtoken");
const { config } = require("../config/env");

function signToken(user) {
  // The payload is intentionally small: the database remains the source of truth for role/user details.
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tokenVersion: user.token_version || 0
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn
    }
  );
}

module.exports = {
  signToken
};
