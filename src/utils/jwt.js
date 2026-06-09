const jwt = require("jsonwebtoken");

function signToken(user) {
  // The payload is intentionally small: the database remains the source of truth for role/user details.
  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    }
  );
}

module.exports = {
  signToken
};
