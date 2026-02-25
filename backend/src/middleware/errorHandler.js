// src/middleware/errorHandler.js
// Centralized error handler — all unhandled errors are funneled here via next(err)

'use strict';

/**
 * Express error-handling middleware.
 *
 * @param {Error}   err  - The error object passed to next(err)
 * @param {object}  req  - Express request object
 * @param {object}  res  - Express response object
 * @param {function} next - Express next function (required as 4th param)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log the full stack trace on the server for debugging
  console.error('🔥 Unhandled Error:', err.stack || err.message);

  // Use the error's status code if set, otherwise default to 500
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only expose stack trace in development to avoid leaking internals
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;