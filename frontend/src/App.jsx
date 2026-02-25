// src/App.jsx
// Root application component.
// Manages global state: the latest analysis result and the ticket history list.
// Passes state and callbacks down to child components.

import React, { useState, useCallback } from 'react';
import TicketForm   from './components/TicketForm';
import TicketResult from './components/TicketResult';
import TicketList   from './components/TicketList';

export default function App() {
  // The most recently analyzed ticket (shown in TicketResult)
  const [latestResult, setLatestResult] = useState(null);

  // Controls whether TicketList re-fetches after a new submission
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * Called by TicketForm after a successful API response.
   * Updates the result panel and triggers a list refresh.
   */
  const handleAnalysisComplete = useCallback((ticket) => {
    setLatestResult(ticket);
    setRefreshKey((k) => k + 1); // Bump key to trigger TicketList re-fetch
  }, []);

  return (
    <div className="app-shell">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-block">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">TriageAI</span>
          </div>
          <p className="header-tagline">Intelligent Support Ticket Classifier</p>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="app-main">
        {/* Left column: form + result */}
        <section className="col-left">
          <TicketForm onAnalysisComplete={handleAnalysisComplete} />
          {latestResult && <TicketResult ticket={latestResult} />}
        </section>

        {/* Right column: history list */}
        <section className="col-right">
          <TicketList refreshKey={refreshKey} />
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <span>TriageAI &copy; {new Date().getFullYear()} — Rule-based AI Classifier</span>
      </footer>
    </div>
  );
}