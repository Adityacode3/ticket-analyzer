// src/controllers/ticketController.js
// Route handler functions for the /api/tickets endpoints.
//
// Controllers are responsible for:
//   1. Extracting and validating request data
//   2. Calling the analyzer and service layer
//   3. Formatting and returning the HTTP response
//   4. Passing unexpected errors to the centralized error handler via next(err)
//
// Controllers do NOT contain business logic or DB queries directly.
// That separation keeps each layer independently testable.

'use strict';

const { analyzeTicket } = require('../analyzer/ticketAnalyzer');
const ticketService     = require('../services/ticketService');

/**
 * POST /api/tickets/analyze
 *
 * Accepts a support message, runs it through the AI analyzer,
 * persists the result, and returns the full analyzed ticket.
 *
 * Request body:
 *   { "message": "I was charged twice for my subscription" }
 *
 * Success response (201):
 *   {
 *     "success": true,
 *     "data": {
 *       "_id": "...",
 *       "message": "I was charged twice for my subscription",
 *       "category": "Billing",
 *       "priority": "P1",
 *       "signals": ["Category match: Billing (2 keyword(s) matched)"],
 *       "keywords": ["charged", "subscription"],
 *       "confidence": 0.09,
 *       "createdAt": "2024-01-15T10:30:00.000Z",
 *       "priorityLabel": "P1 – High"
 *     }
 *   }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function analyzeTicketHandler(req, res, next) {
  try {
    const { message } = req.body;

    // ── Run the classifier ───────────────────────────────────────────────────
    // analyzeTicket is synchronous and pure — no async needed here
    const analysisResult = analyzeTicket(message);

    // ── Persist to MongoDB ───────────────────────────────────────────────────
    const savedTicket = await ticketService.createTicket(message, analysisResult);

    // ── Respond with the full ticket document ────────────────────────────────
    return res.status(201).json({
      success: true,
      data: savedTicket,
    });

  } catch (error) {
    // Pass to centralized error handler in middleware/errorHandler.js
    next(error);
  }
}

/**
 * GET /api/tickets
 *
 * Returns a paginated list of all analyzed tickets, newest first.
 *
 * Query parameters (all optional):
 *   limit  {number} - Number of tickets per page (default: 50, max: 100)
 *   skip   {number} - Number of tickets to skip   (default: 0)
 *
 * Success response (200):
 *   {
 *     "success": true,
 *     "count": 3,
 *     "total": 42,
 *     "data": [ ...ticket objects... ]
 *   }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAllTicketsHandler(req, res, next) {
  try {
    // ── Parse and sanitize pagination params ─────────────────────────────────
    let limit = parseInt(req.query.limit, 10) || 50;
    let skip  = parseInt(req.query.skip,  10) || 0;

    // Enforce sensible bounds to prevent abuse
    if (limit > 100) limit = 100;
    if (limit < 1)   limit = 1;
    if (skip  < 0)   skip  = 0;

    // ── Fetch tickets and total count in parallel ────────────────────────────
    const [tickets, total] = await Promise.all([
      ticketService.getAllTickets({ limit, skip }),
      ticketService.countTickets(),
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,  // Number returned in this page
      total,                   // Total tickets in the collection (for pagination UI)
      data: tickets,
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tickets/:id
 *
 * Returns a single ticket by its MongoDB _id.
 *
 * Success response (200):
 *   { "success": true, "data": { ...ticket } }
 *
 * Not found response (404):
 *   { "success": false, "message": "Ticket not found" }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getTicketByIdHandler(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = await ticketService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });

  } catch (error) {
    // Mongoose throws a CastError if the id is not a valid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID format',
      });
    }
    next(error);
  }
}

module.exports = {
  analyzeTicketHandler,
  getAllTicketsHandler,
  getTicketByIdHandler,
};