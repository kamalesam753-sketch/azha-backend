/**
 * Centralized error handling middleware.
 * All uncaught errors in routes are caught here.
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : err.message || "Request failed";

  if (statusCode === 500) {
    console.error("Unhandled Error:", err.stack || err.message || err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
}

/**
 * Custom application error with HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode || 400;
    this.name = "AppError";
  }
}

module.exports = { errorHandler, AppError };
