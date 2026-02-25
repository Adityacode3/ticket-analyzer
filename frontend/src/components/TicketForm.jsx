// src/components/TicketForm.jsx
// The main input form for submitting a support message for analysis.
//
// Responsibilities:
//   - Controlled textarea input
//   - Client-side length validation (mirrors backend rules)
//   - Submits via analyzeTicket() API service
//   - Shows loading spinner during submission
//   - Shows inline error on failure
//   - Calls onAnalysisComplete(ticket) on success

import React, { useState } from 'react';
import { analyzeTicket } from '../api/ticketService';

const MIN_LENGTH = 5;
const MAX_LENGTH = 2000;

export default function TicketForm({ onAnalysisComplete }) {
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const charCount   = message.length;
  const isUnderMin  = charCount > 0 && charCount < MIN_LENGTH;
  const isOverMax   = charCount > MAX_LENGTH;
  const isSubmitDisabled = loading || charCount < MIN_LENGTH || isOverMax;

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitDisabled) return;

    setLoading(true);
    setError(null);

    try {
      const ticket = await analyzeTicket(message.trim());
      onAnalysisComplete(ticket);
      setMessage(''); // Clear form on success
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <h2 className="card-title">Submit Ticket</h2>
        <p className="card-subtitle">Paste or type a support message to classify it instantly</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="message" className="field-label">
            Support Message
          </label>
          <textarea
            id="message"
            className={`field-textarea ${isUnderMin ? 'field--warn' : ''} ${isOverMax ? 'field--error' : ''}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I was charged twice for my subscription and need a refund urgently…"
            rows={6}
            disabled={loading}
            aria-describedby="char-count"
          />
          <div className="field-meta" id="char-count">
            <span className={`char-count ${isOverMax ? 'char-count--error' : isUnderMin ? 'char-count--warn' : ''}`}>
              {charCount} / {MAX_LENGTH}
            </span>
            {isUnderMin && (
              <span className="field-hint">Minimum {MIN_LENGTH} characters required</span>
            )}
            {isOverMax && (
              <span className="field-hint field-hint--error">Message too long</span>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="alert alert--error" role="alert">
            <span className="alert-icon">✕</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitDisabled}
          aria-busy={loading}
        >
          {loading ? (
            <span className="btn-loading">
              <span className="spinner" aria-hidden="true" />
              Analyzing…
            </span>
          ) : (
            'Analyze Ticket'
          )}
        </button>
      </form>

      {/* Example prompts */}
      <div className="examples-block">
        <p className="examples-label">Try an example:</p>
        <div className="examples-list">
          {[
            'The app crashes every time I try to login — urgent bug!',
            'I want a refund for last month\'s charge on my invoice.',
            'How do I reset my two-factor authentication?',
          ].map((ex) => (
            <button
              key={ex}
              className="example-pill"
              onClick={() => setMessage(ex)}
              disabled={loading}
              type="button"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}