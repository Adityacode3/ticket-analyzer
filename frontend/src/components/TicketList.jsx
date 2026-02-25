// src/components/TicketList.jsx
// Displays a scrollable history of all previously analyzed tickets.
//
// Features:
//   - Auto-fetches on mount and whenever refreshKey changes
//   - Loading skeleton while fetching
//   - Empty state when no tickets exist
//   - Error state with retry button
//   - Each row shows: priority badge, category, truncated message, confidence, timestamp

import React, { useState, useEffect, useCallback } from 'react';
import { fetchTickets } from '../api/ticketService';

const PRIORITY_COLORS = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#22c55e',
};

const LIMIT = 20;

export default function TicketList({ refreshKey }) {
  const [tickets, setTickets]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [skip, setSkip]         = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Fetch initial / refreshed list ─────────────────────────────────────
  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSkip(0);

    try {
      const result = await fetchTickets({ limit: LIMIT, skip: 0 });
      setTickets(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever refreshKey changes (new ticket submitted)
  useEffect(() => {
    loadTickets();
  }, [refreshKey, loadTickets]);

  // ── Load more (pagination) ──────────────────────────────────────────────
  async function loadMore() {
    const newSkip = skip + LIMIT;
    setLoadingMore(true);

    try {
      const result = await fetchTickets({ limit: LIMIT, skip: newSkip });
      setTickets((prev) => [...prev, ...result.data]);
      setSkip(newSkip);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = tickets.length < total;

  // ── Render: loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card list-card">
        <div className="card-header">
          <h2 className="card-title">Ticket History</h2>
        </div>
        <div className="skeleton-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton skeleton--badge" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: error state ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card list-card">
        <div className="card-header">
          <h2 className="card-title">Ticket History</h2>
        </div>
        <div className="alert alert--error" role="alert">
          <span className="alert-icon">✕</span>
          <span>{error}</span>
        </div>
        <button className="btn-secondary" onClick={loadTickets}>
          Retry
        </button>
      </div>
    );
  }

  // ── Render: empty state ─────────────────────────────────────────────────
  if (tickets.length === 0) {
    return (
      <div className="card list-card">
        <div className="card-header">
          <h2 className="card-title">Ticket History</h2>
          <span className="badge-count">0</span>
        </div>
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p className="empty-text">No tickets analyzed yet.</p>
          <p className="empty-subtext">Submit a message on the left to get started.</p>
        </div>
      </div>
    );
  }

  // ── Render: ticket list ─────────────────────────────────────────────────
  return (
    <div className="card list-card">
      <div className="card-header">
        <h2 className="card-title">Ticket History</h2>
        <span className="badge-count">{total}</span>
      </div>

      <ul className="ticket-list" aria-label="Analyzed tickets">
        {tickets.map((ticket) => (
          <li key={ticket._id} className="ticket-row">
            {/* Priority indicator dot */}
            <span
              className="priority-dot"
              style={{ background: PRIORITY_COLORS[ticket.priority] || '#94a3b8' }}
              title={ticket.priority}
              aria-label={`Priority ${ticket.priority}`}
            />

            {/* Main content */}
            <div className="ticket-row-body">
              <div className="ticket-row-top">
                <span className="ticket-category">{ticket.category}</span>
                <span className="ticket-priority-label">{ticket.priority}</span>
                <span className="ticket-confidence">
                  {Math.round((ticket.confidence || 0) * 100)}% conf.
                </span>
              </div>
              <p className="ticket-message-preview">
                {ticket.message.length > 100
                  ? `${ticket.message.slice(0, 100)}…`
                  : ticket.message}
              </p>
              <span className="ticket-date">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Load more */}
      {hasMore && (
        <div className="load-more-block">
          <button
            className="btn-secondary"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : `Load more (${total - tickets.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}