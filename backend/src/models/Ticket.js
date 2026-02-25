// src/models/Ticket.js
// Mongoose schema and model for a support ticket.
// Each document represents one analyzed ticket submission.

'use strict';

const mongoose = require('mongoose');

/**
 * ─── Ticket Schema ────────────────────────────────────────────────────────────
 *
 * Fields:
 *
 *  message     — The raw support message submitted by the user.
 *                Stored as-is to preserve original context for auditing.
 *
 *  category    — The classified category determined by the AI analyzer.
 *                One of: Billing | Technical | General | Account | Unknown
 *                "Unknown" is the safe fallback when no rules match.
 *
 *  priority    — Urgency tier assigned by the analyzer's scoring engine.
 *                P0 = Critical (immediate action)
 *                P1 = High     (same-day response)
 *                P2 = Medium   (within 48 hours)
 *                P3 = Low      (best effort)
 *
 *  signals     — Array of human-readable strings describing WHY the
 *                analyzer assigned this priority. Useful for support
 *                agents to understand the reasoning at a glance.
 *                Example: ["contains urgent keyword", "refund rule applied"]
 *
 *  keywords    — Array of the specific words from the message that
 *                matched rules in the classifier. Provides transparency
 *                into which tokens drove the classification decision.
 *
 *  confidence  — A float between 0.0 and 1.0 representing how strongly
 *                the analyzer matched this ticket to its assigned category.
 *                Higher = more keyword matches relative to total rule set.
 *                Used by the frontend to visually indicate certainty level.
 *
 *  createdAt   — Timestamp of when the ticket was submitted and analyzed.
 *                Auto-managed by Mongoose timestamps option.
 */
const ticketSchema = new mongoose.Schema(
  {
    // ── Raw Input ──────────────────────────────────────────────────────────────
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters'],
      maxlength: [2000, 'Message must not exceed 2000 characters'],
    },

    // ── Classification Output ──────────────────────────────────────────────────
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Billing', 'Technical', 'General', 'Account', 'Unknown'],
        message: '{VALUE} is not a supported category',
      },
      default: 'Unknown',
    },

    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: ['P0', 'P1', 'P2', 'P3'],
        message: '{VALUE} is not a valid priority level',
      },
      default: 'P3',
    },

    // ── Reasoning Transparency ─────────────────────────────────────────────────
    signals: {
      type: [String],
      default: [],
      // Each string is a plain-English explanation of a classification signal.
      // E.g. ["urgency keyword detected: 'immediately'", "category match: Technical x3"]
    },

    keywords: {
      type: [String],
      default: [],
      // The actual words extracted from the message that triggered rules.
      // E.g. ["refund", "payment", "invoice"]
    },

    // ── Confidence Score ───────────────────────────────────────────────────────
    confidence: {
      type: Number,
      required: [true, 'Confidence score is required'],
      min: [0, 'Confidence cannot be less than 0'],
      max: [1, 'Confidence cannot be greater than 1'],
      default: 0,
    },
  },
  {
    // Automatically adds `createdAt` and `updatedAt` fields.
    // `createdAt` is the primary timestamp shown in the UI and API responses.
    timestamps: true,

    // When converting a document to JSON (e.g. in API responses),
    // include virtual fields and remove the internal __v version key.
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v; // Remove Mongoose internal version key from responses
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

/**
 * Index on createdAt descending so that GET /api/tickets
 * can efficiently return tickets sorted newest-first.
 */
ticketSchema.index({ createdAt: -1 });

/**
 * Index on category and priority together to support
 * future filtered queries like "all P0 Billing tickets".
 */
ticketSchema.index({ category: 1, priority: 1 });

// ─── Virtual: priorityLabel ───────────────────────────────────────────────────

/**
 * Virtual field that expands the priority code into a human-readable label.
 * Not stored in DB — computed on the fly when serializing to JSON.
 *
 * Example: "P0" → "P0 – Critical"
 */
ticketSchema.virtual('priorityLabel').get(function () {
  const labels = {
    P0: 'P0 – Critical',
    P1: 'P1 – High',
    P2: 'P2 – Medium',
    P3: 'P3 – Low',
  };
  return labels[this.priority] || this.priority;
});

// ─── Model Export ─────────────────────────────────────────────────────────────

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;