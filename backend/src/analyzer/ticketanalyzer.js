// src/analyzer/ticketAnalyzer.js
// Pure rule-based AI classification engine.
//
// This module is completely stateless and has zero side effects.
// It takes a raw message string and returns a structured analysis object.
// It does NOT interact with the database — that is the service layer's job.
//
// Classification pipeline:
//   1. Normalize the message (lowercase, trim)
//   2. Score each category by counting keyword matches
//   3. Detect urgency signals and accumulate score boosts
//   4. Determine category (highest scoring category wins)
//   5. Determine priority from total score via threshold table
//   6. Calculate confidence score (0.0 – 1.0)
//   7. Apply custom refund override rule (hard override, runs last)
//   8. Return structured result

'use strict';

const {
  CATEGORY_RULES,
  URGENCY_SIGNALS,
  PRIORITY_THRESHOLDS,
  REFUND_RULE,
} = require('../config/rules');

/**
 * Escapes special regex characters in a string so it can be safely
 * used inside a RegExp pattern.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether a keyword appears in the normalized message.
 * Uses word-boundary matching (\b) for single words.
 * For multi-word phrases (e.g. "not working"), uses a simple substring match
 * since \b does not work reliably across spaces.
 *
 * @param {string} message   - Already-lowercased message text
 * @param {string} keyword   - Keyword or phrase to search for (lowercase)
 * @returns {boolean}
 */
function matchesKeyword(message, keyword) {
  const escaped = escapeRegex(keyword);

  if (keyword.includes(' ')) {
    // Multi-word phrase: use simple inclusion check
    return message.includes(keyword);
  }

  // Single word: use word-boundary regex for precision
  // e.g. "billing" matches "billing" but not "unbilling"
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(message);
}

/**
 * STEP 1 & 2 — Score all categories against the message.
 *
 * For each category rule, iterate its keywords and count how many
 * appear in the message. Each match contributes (1 * baseScore) points.
 *
 * Returns an array of category score objects, sorted descending by score.
 *
 * @param {string} normalizedMessage
 * @returns {Array<{ name: string, score: number, matchedKeywords: string[] }>}
 */
function scoreCategoriesFactory(normalizedMessage) {
  return CATEGORY_RULES.map((rule) => {
    const matchedKeywords = [];
    let score = 0;

    for (const keyword of rule.keywords) {
      if (matchesKeyword(normalizedMessage, keyword)) {
        matchedKeywords.push(keyword);
        score += rule.baseScore; // Each match adds baseScore points
      }
    }

    return {
      name: rule.name,
      score,
      matchedKeywords,
    };
  }).sort((a, b) => b.score - a.score); // Highest score first
}

/**
 * STEP 3 — Detect urgency signals in the message.
 *
 * Scans for each urgency keyword. For every match:
 *   - Adds scoreBoost to the urgency score total
 *   - Records the human-readable label as a signal
 *   - Records the matched keyword
 *
 * @param {string} normalizedMessage
 * @returns {{ urgencyScore: number, signals: string[], urgencyKeywords: string[] }}
 */
function detectUrgencySignals(normalizedMessage) {
  let urgencyScore = 0;
  const signals = [];
  const urgencyKeywords = [];

  for (const signal of URGENCY_SIGNALS) {
    if (matchesKeyword(normalizedMessage, signal.keyword)) {
      urgencyScore += signal.scoreBoost;
      signals.push(signal.label);
      urgencyKeywords.push(signal.keyword);
    }
  }

  return { urgencyScore, signals, urgencyKeywords };
}

/**
 * STEP 5 — Map a total numeric score to a priority tier string.
 *
 * Iterates PRIORITY_THRESHOLDS from highest to lowest.
 * The first threshold whose minScore is <= totalScore wins.
 *
 * @param {number} totalScore
 * @returns {string} - One of: 'P0' | 'P1' | 'P2' | 'P3'
 */
function scoreToPriority(totalScore) {
  for (const threshold of PRIORITY_THRESHOLDS) {
    if (totalScore >= threshold.minScore) {
      return threshold.priority;
    }
  }
  return 'P3'; // Safe fallback — should never be reached given thresholds include 0
}

/**
 * STEP 6 — Calculate a confidence score between 0.0 and 1.0.
 *
 * Confidence reflects how strongly the winning category was matched
 * relative to the maximum possible matches for that category.
 *
 * Formula:
 *   confidence = matchedKeywords.length / totalKeywordsInCategory
 *
 * This is then clamped to [0, 1] and rounded to 2 decimal places.
 *
 * Rationale:
 *   - If a Billing ticket matches 10 out of 23 billing keywords → 0.43
 *   - If it matches 1 out of 23 → 0.04 (low confidence, may need human review)
 *   - A perfect match of all keywords → 1.0 (extremely high confidence)
 *
 * Edge case: if no category matched at all, confidence = 0.
 *
 * @param {string} categoryName           - The winning category name
 * @param {string[]} matchedKeywords      - Keywords matched in winning category
 * @returns {number}
 */
function calculateConfidence(categoryName, matchedKeywords) {
  const rule = CATEGORY_RULES.find((r) => r.name === categoryName);

  if (!rule || matchedKeywords.length === 0) {
    return 0;
  }

  const raw = matchedKeywords.length / rule.keywords.length;

  // Clamp to [0, 1] and round to 2 decimal places
  return Math.min(1, Math.max(0, parseFloat(raw.toFixed(2))));
}

/**
 * STEP 7 — Apply the custom refund override rule.
 *
 * If the word "refund" appears in the message, the result is forcibly
 * overridden AFTER all normal scoring is complete:
 *   - category is set to 'Billing'
 *   - priority is set to at least 'P1' (won't downgrade a P0)
 *   - a signal is added explaining the override
 *
 * Priority upgrade logic:
 *   P0 stays P0 (refund rule won't downgrade a critical ticket)
 *   P1/P2/P3 → forced to P1
 *
 * @param {string} normalizedMessage
 * @param {object} result              - The result object to mutate
 * @returns {boolean}                  - true if rule was applied
 */
function applyRefundRule(normalizedMessage, result) {
  if (!matchesKeyword(normalizedMessage, REFUND_RULE.trigger)) {
    return false; // Rule not triggered
  }

  // Force category to Billing
  result.category = REFUND_RULE.forceCategory;

  // Only upgrade priority — never downgrade (P0 stays P0)
  const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const currentRank = priorityRank[result.priority];
  const forcedRank = priorityRank[REFUND_RULE.forcePriority];

  if (currentRank > forcedRank) {
    // Current priority is lower than forced priority → upgrade
    result.priority = REFUND_RULE.forcePriority;
  }

  // Add the override signal so support agents can see why this was escalated
  result.signals.push(REFUND_RULE.signal);

  return true; // Rule was applied
}

/**
 * ─── MAIN EXPORT: analyzeTicket ───────────────────────────────────────────────
 *
 * Orchestrates the full classification pipeline for a single ticket message.
 *
 * @param {string} message - Raw user-submitted support message
 * @returns {{
 *   category:   string,    // Classified category (e.g. "Billing")
 *   priority:   string,    // Priority tier (e.g. "P1")
 *   signals:    string[],  // Human-readable list of classification reasons
 *   keywords:   string[],  // Keywords from the message that drove classification
 *   confidence: number,    // Score 0.0–1.0 indicating classification certainty
 * }}
 */
function analyzeTicket(message) {
  // ── Guard: ensure message is a non-empty string ────────────────────────────
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      category: 'Unknown',
      priority: 'P3',
      signals: ['No message content provided'],
      keywords: [],
      confidence: 0,
    };
  }

  // ── STEP 1: Normalize ──────────────────────────────────────────────────────
  const normalized = message.toLowerCase().trim();

  // ── STEP 2: Score categories ───────────────────────────────────────────────
  const categoryScores = scoreCategoriesFactory(normalized);

  // The winning category is the one with the highest score
  const topCategory = categoryScores[0];

  // ── STEP 3: Detect urgency signals ────────────────────────────────────────
  const { urgencyScore, signals, urgencyKeywords } = detectUrgencySignals(normalized);

  // ── STEP 4: Determine category ────────────────────────────────────────────
  // If the top category has zero matches, classify as Unknown
  const category = topCategory.score > 0 ? topCategory.name : 'Unknown';

  // ── Combine all matched keywords ──────────────────────────────────────────
  // Category keywords + urgency keywords, deduplicated
  const allMatchedKeywords = [
    ...new Set([...topCategory.matchedKeywords, ...urgencyKeywords]),
  ];

  // ── Add a category signal if category was determined ─────────────────────
  const categorySignals = [];
  if (topCategory.score > 0) {
    categorySignals.push(
      `Category match: ${category} (${topCategory.matchedKeywords.length} keyword(s) matched)`
    );
  } else {
    categorySignals.push('No category keywords matched — classified as Unknown');
  }

  // ── STEP 5: Calculate total score and determine priority ──────────────────
  const totalScore = topCategory.score + urgencyScore;
  const priority = scoreToPriority(totalScore);

  // ── STEP 6: Calculate confidence ─────────────────────────────────────────
  const confidence = calculateConfidence(category, topCategory.matchedKeywords);

  // ── Assemble result ───────────────────────────────────────────────────────
  const result = {
    category,
    priority,
    signals: [...categorySignals, ...signals],
    keywords: allMatchedKeywords,
    confidence,
  };

  // ── STEP 7: Apply custom refund override (runs last) ──────────────────────
  applyRefundRule(normalized, result);

  return result;
}

module.exports = { analyzeTicket };