// src/app.js
// Express application factory — middleware stack + routes + error handling

'use strict';

const express = require('express');
const cors = require('cors');
const ticketRoutes = require('./routes/ticketRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────

// Allow cross-origin requests from the React frontend
app.use(cors({
  origin: '*', // In production, restrict this to your frontend domain
  methods: ['GET', 'POST'],
}));

// Parse incoming JSON request bodies
app.use(express.json());

// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * GET /health
 * Simple liveness probe used by Docker and load balancers
 * to confirm the service is up and accepting traffic.
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/tickets', ticketRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

/**
 * Catch-all for any route not matched above.
 * Must be placed AFTER all valid routes.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────

/**
 * All errors passed via next(err) land here.
 * Must be defined with 4 parameters so Express
 * recognizes it as an error-handling middleware.
 */
app.use(errorHandler);

module.exports = app;