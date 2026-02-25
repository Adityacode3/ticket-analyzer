// src/routes/ticketRoutes.js
// Express router for all /api/tickets endpoints.
//
// Route definitions are kept thin — they only wire middleware and controllers.
// No logic lives here.
//
// Mounted at: /api/tickets  (see app.js)

'use strict';

const express = require('express');
const router  = express.Router();

const validateTicket = require('../middleware/validateTicket');
const {
  analyzeTicketHandler,
  getAllTicketsHandler,
  getTicketByIdHandler,
} = require('../controllers/ticketController');

/**
 * POST /api/tickets/analyze
 *
 * Analyze and classify a new support ticket message.
 *
 * Middleware chain:
 *   1. validateTicket   — Ensures req.body.message is present and valid
 *   2. analyzeTicketHandler — Runs classifier, persists, returns result
 */
router.post('/analyze', validateTicket, analyzeTicketHandler);

/**
 * GET /api/tickets
 *
 * Retrieve all tickets (newest first) with optional pagination.
 *
 * Query params:
 *   ?limit=50   (default 50, max 100)
 *   ?skip=0     (default 0)
 */
router.get('/', getAllTicketsHandler);

/**
 * GET /api/tickets/:id
 *
 * Retrieve a single ticket by MongoDB ObjectId.
 */
router.get('/:id', getTicketByIdHandler);

module.exports = router;