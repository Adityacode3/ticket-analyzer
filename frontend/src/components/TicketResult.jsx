// src/components/TicketResult.jsx
// Displays the AI classification result for the most recently analyzed ticket.
//
// Shows:
//   - Category badge
//   - Priority badge with color coding
//   - Confidence bar (visual 0–100%)
//   - Matched keywords
//   - Classification signals (reasoning)
//   - Original message
//   - Timestamp

import React from 'react';

// Priority metadata: color class and human label
const PRIORITY_META = {
  P0: { cls: 'priority--p0', label: 'P0 · Critical', emoji: '🔴' },
  P1: { cls: 'priority--p1', label: 'P1 · High',     emoji: '🟠' },
  P2: { cls: 'priority--p2', label: 'P2 · Medium',   emoji: '🟡' },
  P3: { cls: 'priority--p3', label: 'P3 · Low',      emoji: '🟢' },
};

const CATEGORY_META = {
  Billing:   { cls: 'category--billing',   icon: '💳' },
  Technical: { cls: 'category--technical', icon: '⚙️' },
  Account:   { cls: 'category--account',   icon: '👤' },
  General:   { cls: 'category--general',   icon: '💬' },
  Unknown:   { cls: 'category--unknown',   icon: '❓' },
};

export default function TicketResult({ ticket }) {
  if (!ticket) return null;

  const priority = PRIORITY_META[ticket.priority] || PRIORITY_META.P3;
  const category = CATEGORY_META[ticket.category] || CATEGORY_META.Unknown;
  const confidencePct = Math.round((ticket.confidence || 0) * 100);

  const formattedDate = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString()
    : 'Just now';

  return (
    <div className="card result-card result-card--animate">
      <div className="card-header">
        <h2 className="card-title">Classification Result</h2>
        <span className="result-timestamp">{formattedDate}</span>
      </div>

      {/* ── Top badges row ─────────────────────────────────────────────── */}
      <div className="result-badges">
        <div className={`badge badge-category ${category.cls}`}>
          <span className="badge-icon">{category.icon}</span>
          <span>{ticket.category}</span>
        </div>
        <div className={`badge badge-priority ${priority.cls}`}>
          <span className="badge-icon">{priority.emoji}</span>
          <span>{priority.label}</span>
        </div>
      </div>

      {/* ── Confidence bar ─────────────────────────────────────────────── */}
      <div className="confidence-block">
        <div className="confidence-header">
          <span className="confidence-label">Confidence</span>
          <span className="confidence-value">{confidencePct}%</span>
        </div>
        <div className="confidence-track">
          <div
            className="confidence-fill"
            style={{ width: `${confidencePct}%` }}
            aria-valuenow={confidencePct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <p className="confidence-hint">
          {confidencePct >= 50
            ? 'High confidence — strong keyword match'
            : confidencePct >= 20
            ? 'Moderate confidence — partial keyword match'
            : 'Low confidence — consider manual review'}
        </p>
      </div>

      {/* ── Matched keywords ───────────────────────────────────────────── */}
      {ticket.keywords && ticket.keywords.length > 0 && (
        <div className="result-section">
          <h3 className="result-section-title">Matched Keywords</h3>
          <div className="keyword-list">
            {ticket.keywords.map((kw) => (
              <span key={kw} className="keyword-tag">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Classification signals ─────────────────────────────────────── */}
      {ticket.signals && ticket.signals.length > 0 && (
        <div className="result-section">
          <h3 className="result-section-title">Classification Signals</h3>
          <ul className="signals-list">
            {ticket.signals.map((signal, i) => (
              <li key={i} className="signal-item">
                <span className="signal-dot" aria-hidden="true">→</span>
                {signal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Original message ──────────────────────────────────────────── */}
      <div className="result-section">
        <h3 className="result-section-title">Original Message</h3>
        <blockquote className="original-message">{ticket.message}</blockquote>
      </div>
    </div>
  );
}