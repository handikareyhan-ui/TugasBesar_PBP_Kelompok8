'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'bansoschain_secret_key_2026';

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn(`Authentication blocked: Authorization header missing token`);
    const err = new Error("Access token required");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn(`Authentication blocked: Invalid or expired token`);
      const authErr = new Error("Invalid or expired token");
      authErr.statusCode = 403;
      authErr.code = "UNAUTHORIZED";
      return next(authErr);
    }
    req.user = user;
    next();
  });
}

// Middleware to authorize specific roles
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      logger.warn(`Authorization blocked for user '${req.user?.username}': insufficient permissions. Required roles: [${allowedRoles}]`);
      const err = new Error("Unauthorized access: insufficient privileges");
      err.statusCode = 403;
      err.code = "UNAUTHORIZED";
      return next(err);
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  JWT_SECRET
};
