// src/services/ticketService.js
// Data access layer — all MongoDB interactions for tickets live here.
//
// The service layer sits between the controller and the database.
// Controllers never touch Mongoose directly; they call service methods.
// This separation makes it easy to swap the data store or mock it in tests.

'use strict';

const Ticket = require('../models/Ticket');

/**
 * Persist a fully-analyzed ticket to MongoDB.
 *
 * Receives the raw message and the structured result from ticketAnalyzer,
 * merges them into a single document, and saves it.
 *
 * @param {string} message        - Original user message
 * @param {object} analysisResult - Output from analyzeTicket()
 * @param {string} analysisResult.category
 * @param {string} analysisResult.priority
 * @param {string[]} analysisResult.signals
 * @param {string[]} analysisResult.keywords
 * @param {number} analysisResult.confidence
 *
 * @returns {Promise<object>} The saved Mongoose document
 * @throws Will throw if Mongoose validation fails or DB is unreachable
 */
async function createTicket(message, analysisResult) {
  const ticket = new Ticket({
    message,
    category:   analysisResult.category,
    priority:   analysisResult.priority,
    signals:    analysisResult.signals,
    keywords:   analysisResult.keywords,
    confidence: analysisResult.confidence,
  });

  // .save() triggers Mongoose validators before writing to MongoDB
  const saved = await ticket.save();
  return saved;
}

/**
 * Retrieve all tickets from MongoDB, newest first.
 *
 * Supports optional pagination via skip/limit so the frontend
 * can load tickets in pages as the dataset grows.
 *
 * @param {object} options
 * @param {number} [options.limit=50]  - Max number of tickets to return
 * @param {number} [options.skip=0]    - Number of tickets to skip (for pagination)
 *
 * @returns {Promise<object[]>} Array of Mongoose documents
 */
async function getAllTickets({ limit = 50, skip = 0 } = {}) {
  const tickets = await Ticket.find()
    .sort({ createdAt: -1 }) // Newest first — matches the createdAt index
    .skip(skip)
    .limit(limit)
    .lean(); // .lean() returns plain JS objects instead of Mongoose documents
               // Faster for read-only operations since we don't need save() etc.

  return tickets;
}

/**
 * Retrieve a single ticket by its MongoDB _id.
 *
 * @param {string} id - MongoDB ObjectId string
 * @returns {Promise<object|null>} The ticket document, or null if not found
 */
async function getTicketById(id) {
  const ticket = await Ticket.findById(id).lean();
  return ticket;
}

/**
 * Return the total count of tickets in the collection.
 * Useful for building pagination metadata in API responses.
 *
 * @returns {Promise<number>}
 */
async function countTickets() {
  return Ticket.countDocuments();
}

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  countTickets,
};