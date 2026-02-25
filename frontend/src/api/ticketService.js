// src/api/ticketService.js
// Axios API client for communicating with the backend.
//
// All HTTP calls are centralized here so:
//   - Base URL is configured in one place
//   - Error handling is consistent
//   - Components stay clean and free of fetch logic

import axios from 'axios';

// ── Axios Instance ─────────────────────────────────────────────────────────────
// Base URL: in Docker, nginx proxies /api → backend:5000
// In local dev (non-Docker), set VITE_API_URL in a .env file
const BASE_URL = import.meta.env.VITE_API_URL || '';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout
});

// ── Response Interceptor ──────────────────────────────────────────────────────
// Normalize error messages so components receive a consistent error shape
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0] ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ── API Methods ───────────────────────────────────────────────────────────────

/**
 * POST /api/tickets/analyze
 * Submits a message for AI classification.
 *
 * @param {string} message
 * @returns {Promise<object>} The analyzed ticket object
 */
export async function analyzeTicket(message) {
  const response = await apiClient.post('/api/tickets/analyze', { message });
  return response.data.data;
}

/**
 * GET /api/tickets
 * Retrieves all tickets, newest first.
 *
 * @param {object} params  - Optional: { limit, skip }
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function fetchTickets(params = {}) {
  const response = await apiClient.get('/api/tickets', { params });
  return {
    data: response.data.data,
    total: response.data.total,
  };
}