'use strict';

function errorHandler(err, req, res, next) {
  const logger = global.logger || console;
  
  // Determine standard HTTP status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Set clean error message
  const message = err.message || "Internal Server Error";
  
  // Set custom error code if exists (default is INTERNAL_ERROR)
  const code = err.code || (statusCode === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR");

  // Log error with Winston internally
  if (statusCode >= 500) {
    logger.error(`[API ERROR] ${req.method} ${req.url} - ${err.stack || err.message}`);
  } else {
    logger.warn(`[API WARN] ${req.method} ${req.url} - ${err.message}`);
  }

  // Format standard error response
  return res.status(statusCode).json({
    success: false,
    error: message,
    code: code,
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
