// src/middleware/validateTicket.js
// Input validation middleware for the POST /api/tickets/analyze endpoint.
//
// Runs BEFORE the controller to ensure the request body is well-formed.
// Returns a 400 response immediately if validation fails,
// so the controller can safely assume req.body.message is a valid string.
//
// Keeping validation in middleware rather than the controller:
//   - Keeps controllers clean and focused on business logic
//   - Makes validation rules reusable across multiple routes
//   - Makes validation independently testable

'use strict';

const MIN_LENGTH = 5;
const MAX_LENGTH = 2000;

/**
 * Validates the request body for ticket analysis.
 *
 * Rules:
 *   - req.body must exist
 *   - req.body.message must be present
 *   - req.body.message must be a string
 *   - req.body.message (trimmed) must be between MIN_LENGTH and MAX_LENGTH characters
 *
 * On failure: responds 400 with a structured error object listing all violations.
 * On success: calls next() to pass control to the controller.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateTicket(req, res, next) {
  const errors = [];

  // ── Check body exists ────────────────────────────────────────────────────
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Request body is missing or malformed',
      errors: ['Request body must be a JSON object'],
    });
  }

  const { message } = req.body;

  // ── Check message presence ───────────────────────────────────────────────
  if (message === undefined || message === null) {
    errors.push('message is required');
  } else if (typeof message !== 'string') {
    // ── Check message type ─────────────────────────────────────────────────
    errors.push('message must be a string');
  } else {
    const trimmed = message.trim();

    // ── Check minimum length ───────────────────────────────────────────────
    if (trimmed.length < MIN_LENGTH) {
      errors.push(
        `message must be at least ${MIN_LENGTH} characters (received ${trimmed.length})`
      );
    }

    // ── Check maximum length ───────────────────────────────────────────────
    if (trimmed.length > MAX_LENGTH) {
      errors.push(
        `message must not exceed ${MAX_LENGTH} characters (received ${trimmed.length})`
      );
    }

    // ── Sanitize: write trimmed value back so controller gets clean input ──
    if (errors.length === 0) {
      req.body.message = trimmed;
    }
  }

  // ── Return all validation errors at once ─────────────────────────────────
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // ── All good — proceed to controller ─────────────────────────────────────
  next();
}

module.exports = validateTicket;