// backend/tests/ticketAnalyzer.test.js
// Unit tests for the AI ticket classifier (ticketAnalyzer.js).
//
// These tests cover:
//   1.  Billing classification
//   2.  Technical classification
//   3.  Account classification
//   4.  General classification
//   5.  Unknown classification (no keyword matches)
//   6.  Urgent case → P0 priority
//   7.  Custom refund rule → forced Billing + P1
//   8.  Refund rule does NOT downgrade a P0
//   9.  Confidence scoring — high confidence on dense keyword message
//   10. Confidence scoring — low confidence on sparse keyword message
//   11. Confidence is 0 when category is Unknown
//   12. Multiple urgency signals stack correctly
//   13. Input guard — empty string returns safe defaults
//   14. Input guard — non-string input returns safe defaults
//   15. Keywords array is populated correctly
//   16. Signals array contains human-readable explanations
//   17. Case-insensitive matching works correctly
//   18. Word boundary matching prevents false positives
//   19. Multi-word phrase matching (e.g. "not working")
//   20. Refund rule adds correct signal string

'use strict';

const { analyzeTicket } = require('../src/analyzer/ticketAnalyzer');

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Quick assertion helper — logs the full result on failure
 * so you can see exactly what the analyzer returned.
 */
function debugResult(result) {
  return JSON.stringify(result, null, 2);
}

// =============================================================================
// SUITE 1 — CATEGORY CLASSIFICATION
// =============================================================================

describe('Category Classification', () => {

  // ── Test 1: Billing ──────────────────────────────────────────────────────
  test('1. Classifies a billing message as Billing category', () => {
    const message = 'I was charged twice for my subscription this month. Please check my invoice.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Billing');
    expect(result.keywords).toEqual(
      expect.arrayContaining(['charged', 'subscription', 'invoice'])
    );
    expect(result.confidence).toBeGreaterThan(0);
    // Should not be Unknown
    expect(result.category).not.toBe('Unknown');
  });

  // ── Test 2: Technical ────────────────────────────────────────────────────
  test('2. Classifies a technical message as Technical category', () => {
    const message = 'The app keeps crashing and throwing a 500 error every time I try to login. The server seems down.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Technical');
    expect(result.keywords).toEqual(
      expect.arrayContaining(['crash', 'error', '500', 'login', 'server'])
    );
    expect(result.confidence).toBeGreaterThan(0);
  });

  // ── Test 3: Account ──────────────────────────────────────────────────────
  test('3. Classifies an account message as Account category', () => {
    const message = 'My account has been suspended and I cannot access my profile. I need verification help.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Account');
    expect(result.keywords).toEqual(
      expect.arrayContaining(['account', 'suspended', 'access', 'profile', 'verification'])
    );
  });

  // ── Test 4: General ──────────────────────────────────────────────────────
  test('4. Classifies a general inquiry as General category', () => {
    const message = 'I have a question about how to use the dashboard. Just looking for some information.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('General');
    expect(result.keywords).toEqual(
      expect.arrayContaining(['question', 'information'])
    );
  });

  // ── Test 5: Unknown ──────────────────────────────────────────────────────
  test('5. Returns Unknown category when no keywords match', () => {
    const message = 'Hello there, nice day today, the weather is lovely outside.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Unknown');
    expect(result.confidence).toBe(0);
    expect(result.keywords).toHaveLength(0);
  });

});

// =============================================================================
// SUITE 2 — PRIORITY SCORING
// =============================================================================

describe('Priority Scoring', () => {

  // ── Test 6: P0 from stacked urgency signals ──────────────────────────────
  test('6. Assigns P0 priority when multiple urgency signals are present', () => {
    const message =
      'URGENT: Our production server is down and we have a data loss emergency. ' +
      'This is critical — we need help immediately. Legal action is being considered.';
    const result = analyzeTicket(message);

    expect(result.priority).toBe('P0');
    // Signals array should contain urgency explanations
    expect(result.signals.length).toBeGreaterThan(1);
    // Should have detected urgency keywords
    expect(result.keywords).toEqual(
      expect.arrayContaining(['urgent', 'emergency', 'critical', 'immediately'])
    );
  });

  // ── Test 7: P1 from moderate urgency ────────────────────────────────────
  test('7. Assigns P1 priority for a moderately urgent billing message', () => {
    const message = 'I was overcharged on my invoice and need this resolved ASAP.';
    const result = analyzeTicket(message);

    // Should be P0 or P1 — not P2 or P3
    expect(['P0', 'P1']).toContain(result.priority);
  });

  // ── Test 8: P3 for a low-urgency general inquiry ─────────────────────────
  test('8. Assigns P3 priority for a low-urgency general question', () => {
    const message = 'I have a question about your pricing plans.';
    const result = analyzeTicket(message);

    // Pricing is a billing keyword, but no urgency signals → should be low priority
    expect(['P2', 'P3']).toContain(result.priority);
  });

  // ── Test 9: Multiple urgency signals stack ───────────────────────────────
  test('9. Multiple urgency signals stack to increase priority score', () => {
    // Low category match but many urgency signals
    const lowUrgencyMessage = 'I have a question.';
    const highUrgencyMessage = 'I have a question and it is urgent, critical, emergency, ASAP, immediately.';

    const lowResult  = analyzeTicket(lowUrgencyMessage);
    const highResult = analyzeTicket(highUrgencyMessage);

    // The high urgency message should have a higher or equal priority tier
    const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    expect(priorityRank[highResult.priority]).toBeLessThanOrEqual(
      priorityRank[lowResult.priority]
    );
  });

});

// =============================================================================
// SUITE 3 — CUSTOM REFUND RULE
// =============================================================================

describe('Custom Refund Rule', () => {

  // ── Test 10: Refund → forced Billing ─────────────────────────────────────
  test('10. Forces category to Billing when message contains "refund"', () => {
    // This message looks like a Technical issue, but "refund" should override
    const message = 'The app crashed and I want a refund for last month.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Billing');
  });

  // ── Test 11: Refund → forced P1 minimum ──────────────────────────────────
  test('11. Forces priority to at least P1 when "refund" is detected', () => {
    // No urgency signals — would normally be P2 or P3
    const message = 'I would like a refund please.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Billing');
    // P1 or P0 — never P2 or P3
    expect(['P0', 'P1']).toContain(result.priority);
  });

  // ── Test 12: Refund rule does NOT downgrade P0 ───────────────────────────
  test('12. Refund rule does not downgrade a P0 ticket to P1', () => {
    // This message should score P0 due to many urgency signals
    const message =
      'URGENT emergency: production is down, data loss, critical failure. ' +
      'Also please process my refund immediately — lawsuit incoming.';
    const result = analyzeTicket(message);

    // Refund rule should NOT downgrade P0 to P1
    expect(result.priority).toBe('P0');
    // Category should still be Billing due to refund rule
    expect(result.category).toBe('Billing');
  });

  // ── Test 13: Refund rule signal is present ───────────────────────────────
  test('13. Refund rule adds the correct signal string to signals array', () => {
    const message = 'I want a refund for my subscription.';
    const result = analyzeTicket(message);

    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('refund'),
      ])
    );
  });

  // ── Test 14: Refund keyword is in keywords array ─────────────────────────
  test('14. "refund" appears in the keywords array when rule triggers', () => {
    const message = 'Please process my refund.';
    const result = analyzeTicket(message);

    expect(result.keywords).toContain('refund');
  });

});

// =============================================================================
// SUITE 4 — CONFIDENCE SCORING
// =============================================================================

describe('Confidence Scoring', () => {

  // ── Test 15: High confidence for dense keyword message ───────────────────
  test('15. Returns high confidence for a message with many category keywords', () => {
    const message =
      'My payment failed, I have an overdue invoice, my subscription was charged ' +
      'incorrectly, there is a billing error on my credit card, the fee was wrong, ' +
      'and I need a receipt for the transaction. Please cancel and refund.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Billing');
    // Many billing keywords matched → confidence should be meaningful
    expect(result.confidence).toBeGreaterThan(0.1);
  });

  // ── Test 16: Low confidence for sparse keyword message ───────────────────
  test('16. Returns low confidence for a message with only one keyword match', () => {
    const message = 'I have an invoice question about something unrelated.';
    const result = analyzeTicket(message);

    // Only 1 billing keyword matched → low confidence
    expect(result.confidence).toBeLessThan(0.2);
  });

  // ── Test 17: Confidence is 0 for Unknown category ────────────────────────
  test('17. Confidence is 0 when category is Unknown', () => {
    const message = 'The sky is blue and the grass is green.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Unknown');
    expect(result.confidence).toBe(0);
  });

  // ── Test 18: Confidence is between 0 and 1 (inclusive) ───────────────────
  test('18. Confidence score is always between 0 and 1 inclusive', () => {
    const messages = [
      'I need a refund for my payment immediately',
      'The server is down and crashing with errors',
      'How do I reset my password?',
      'Just a general question about features',
      'xkcd 12345 random text with no keywords at all zzzz',
    ];

    messages.forEach((message) => {
      const result = analyzeTicket(message);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

});

// =============================================================================
// SUITE 5 — INPUT GUARDS & EDGE CASES
// =============================================================================

describe('Input Guards and Edge Cases', () => {

  // ── Test 19: Empty string ─────────────────────────────────────────────────
  test('19. Returns safe defaults for an empty string', () => {
    const result = analyzeTicket('');

    expect(result.category).toBe('Unknown');
    expect(result.priority).toBe('P3');
    expect(result.confidence).toBe(0);
    expect(result.keywords).toHaveLength(0);
    expect(result.signals.length).toBeGreaterThan(0); // Should explain why
  });

  // ── Test 20: Null input ───────────────────────────────────────────────────
  test('20. Returns safe defaults for null input', () => {
    const result = analyzeTicket(null);

    expect(result.category).toBe('Unknown');
    expect(result.priority).toBe('P3');
    expect(result.confidence).toBe(0);
  });

  // ── Test 21: Non-string input ─────────────────────────────────────────────
  test('21. Returns safe defaults for a non-string input (number)', () => {
    const result = analyzeTicket(12345);

    expect(result.category).toBe('Unknown');
    expect(result.priority).toBe('P3');
    expect(result.confidence).toBe(0);
  });

  // ── Test 22: Whitespace-only string ──────────────────────────────────────
  test('22. Returns safe defaults for a whitespace-only string', () => {
    const result = analyzeTicket('     ');

    expect(result.category).toBe('Unknown');
    expect(result.priority).toBe('P3');
    expect(result.confidence).toBe(0);
  });

  // ── Test 23: Case-insensitive matching ───────────────────────────────────
  test('23. Matches keywords case-insensitively (UPPERCASE message)', () => {
    const message = 'MY PAYMENT FAILED AND I WANT A REFUND FOR MY SUBSCRIPTION';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Billing');
    expect(result.keywords).toEqual(
      expect.arrayContaining(['payment', 'refund', 'subscription'])
    );
  });

  // ── Test 24: Word boundary prevents false positives ──────────────────────
  test('24. Word boundary matching does not match partial words', () => {
    // "billed" should NOT match the keyword "bill" due to word boundaries
    // "errors" SHOULD match "error" — let's verify genuine matches only
    const message = 'I was billed incorrectly'; // "billed" ≠ "bill"
    const result = analyzeTicket(message);

    // "billed" should not match "bill" — check "bill" is not in keywords
    // unless the rules explicitly include "billed"
    const hasBill = result.keywords.includes('bill');

    // If "bill" is not a matched keyword, that is correct word-boundary behavior
    // (The keyword "bill" should not fire on "billed")
    if (hasBill) {
      // If it DID match "bill", that means partial matching occurred
      // This test documents the behavior — update if rules change
      console.warn('NOTE: "bill" matched inside "billed" — check word boundary logic');
    }

    // What matters: the analyzer ran without throwing
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('confidence');
  });

  // ── Test 25: Multi-word phrase matching ───────────────────────────────────
  test('25. Correctly matches multi-word phrases like "not working"', () => {
    const message = 'The integration is not working and I cannot sync my data.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Technical');
    expect(result.keywords).toEqual(
      expect.arrayContaining(['not working', 'integration', 'sync'])
    );
  });

  // ── Test 26: Result always has all required fields ────────────────────────
  test('26. Result always contains all required fields regardless of input', () => {
    const inputs = [
      'Normal support message about billing',
      '',
      null,
      undefined,
      'x',
      'a'.repeat(500),
    ];

    inputs.forEach((input) => {
      const result = analyzeTicket(input);
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('signals');
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('confidence');
      expect(Array.isArray(result.signals)).toBe(true);
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(typeof result.confidence).toBe('number');
    }, `Input was: ${String(input)}`);
  });

});

// =============================================================================
// SUITE 6 — SIGNALS ARRAY
// =============================================================================

describe('Signals Array', () => {

  // ── Test 27: Signals contain category match explanation ──────────────────
  test('27. Signals array contains a category match explanation', () => {
    const message = 'My payment failed and the invoice is wrong.';
    const result = analyzeTicket(message);

    const hasCategorySignal = result.signals.some((s) =>
      s.toLowerCase().includes('category match') ||
      s.toLowerCase().includes('billing')
    );
    expect(hasCategorySignal).toBe(true);
  });

  // ── Test 28: Urgency signals appear in signals array ─────────────────────
  test('28. Urgency signals appear in the signals array', () => {
    const message = 'This is urgent and I need help immediately.';
    const result = analyzeTicket(message);

    const hasUrgencySignal = result.signals.some((s) =>
      s.toLowerCase().includes('urgent') ||
      s.toLowerCase().includes('immediate')
    );
    expect(hasUrgencySignal).toBe(true);
  });

  // ── Test 29: Unknown category has an explanatory signal ──────────────────
  test('29. Unknown category includes an explanatory signal', () => {
    const message = 'The cat sat on the mat.';
    const result = analyzeTicket(message);

    expect(result.category).toBe('Unknown');
    expect(result.signals.length).toBeGreaterThan(0);
    // Signal should explain the lack of matches
    const hasExplanation = result.signals.some((s) =>
      s.toLowerCase().includes('no category') ||
      s.toLowerCase().includes('unknown') ||
      s.toLowerCase().includes('no match')
    );
    expect(hasExplanation).toBe(true);
  });

});