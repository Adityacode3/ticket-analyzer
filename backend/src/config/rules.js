// src/config/rules.js
// Central rule configuration for the keyword-based AI classifier.
//
// This file is the single source of truth for:
//   - Category definitions and their associated keywords
//   - Urgency signal keywords that elevate priority
//   - Priority score thresholds (how many points = which tier)
//   - The custom refund override rule
//
// Keeping rules in a dedicated config file means the analyzer logic
// (ticketAnalyzer.js) stays generic and rules can be updated without
// touching classification code.

'use strict';

/**
 * ─── CATEGORY RULES ───────────────────────────────────────────────────────────
 *
 * Each category has:
 *   name       — The canonical category string stored in the DB
 *   keywords   — Words that, if found in the message, vote for this category
 *   baseScore  — Points added to priority score per keyword match
 *
 * Scoring rationale:
 *   - Billing and Technical issues are operationally more expensive to resolve,
 *     so they carry a higher baseScore, making them more likely to escalate.
 *   - General and Account issues are typically lower-stakes and score lower.
 *
 * All keyword matching is case-insensitive and whole-word aware
 * (handled in the analyzer).
 */
const CATEGORY_RULES = [
  {
    name: 'Billing',
    keywords: [
      'payment',
      'invoice',
      'charge',
      'charged',
      'billing',
      'bill',
      'subscription',
      'refund',
      'price',
      'pricing',
      'cost',
      'fee',
      'fees',
      'overcharged',
      'credit',
      'debit',
      'transaction',
      'receipt',
      'plan',
      'upgrade',
      'downgrade',
      'cancel',
      'cancellation',
    ],
    baseScore: 3, // Higher weight — billing disputes are business-critical
  },
  {
    name: 'Technical',
    keywords: [
      'error',
      'bug',
      'crash',
      'broken',
      'not working',
      'down',
      'outage',
      'slow',
      'loading',
      'timeout',
      'failed',
      'failure',
      'issue',
      'problem',
      'glitch',
      'freeze',
      'frozen',
      'install',
      'installation',
      'update',
      'login',
      'logout',
      'password',
      'reset',
      'api',
      'integration',
      'sync',
      'data loss',
      '500',
      '404',
      'server',
    ],
    baseScore: 3, // Higher weight — technical failures impact usability directly
  },
  {
    name: 'Account',
    keywords: [
      'account',
      'profile',
      'username',
      'email',
      'sign up',
      'signup',
      'register',
      'registration',
      'verify',
      'verification',
      'access',
      'locked',
      'lock',
      'banned',
      'suspend',
      'suspended',
      'delete account',
      'close account',
      'two factor',
      '2fa',
      'authentication',
    ],
    baseScore: 2,
  },
  {
    name: 'General',
    keywords: [
      'question',
      'help',
      'how to',
      'how do',
      'wondering',
      'curious',
      'information',
      'info',
      'feedback',
      'suggestion',
      'feature',
      'request',
      'inquiry',
      'support',
      'contact',
      'complaint',
      'compliment',
      'review',
    ],
    baseScore: 1, // Lower weight — general inquiries are lowest urgency by default
  },
];

/**
 * ─── URGENCY SIGNALS ──────────────────────────────────────────────────────────
 *
 * These keywords independently boost the priority score regardless of category.
 * They represent emotional or situational urgency expressed by the user.
 *
 * Each signal adds `scoreBoost` to the running priority score.
 * Multiple urgency signals stack — e.g. "urgent ASAP immediately" = +15 points.
 *
 * The `label` is stored in the ticket's `signals` array so support agents
 * can see plain-English reasoning for why priority was elevated.
 */
const URGENCY_SIGNALS = [
  { keyword: 'urgent',       scoreBoost: 5, label: 'User flagged message as urgent' },
  { keyword: 'asap',         scoreBoost: 5, label: 'User requested ASAP resolution' },
  { keyword: 'immediately',  scoreBoost: 5, label: 'User requested immediate action' },
  { keyword: 'emergency',    scoreBoost: 8, label: 'User indicated an emergency' },
  { keyword: 'critical',     scoreBoost: 6, label: 'User described issue as critical' },
  { keyword: 'cannot work',  scoreBoost: 6, label: 'User is completely blocked from working' },
  { keyword: "can't work",   scoreBoost: 6, label: 'User is completely blocked from working' },
  { keyword: 'production',   scoreBoost: 6, label: 'Issue is affecting production environment' },
  { keyword: 'data loss',    scoreBoost: 8, label: 'Potential data loss reported' },
  { keyword: 'lost data',    scoreBoost: 8, label: 'Potential data loss reported' },
  { keyword: 'deadline',     scoreBoost: 4, label: 'User has a time-sensitive deadline' },
  { keyword: 'lawsuit',      scoreBoost: 9, label: 'Legal threat detected — escalate immediately' },
  { keyword: 'legal',        scoreBoost: 7, label: 'Legal concern raised by user' },
  { keyword: 'frustrated',   scoreBoost: 2, label: 'User expressed frustration' },
  { keyword: 'angry',        scoreBoost: 2, label: 'User expressed anger' },
  { keyword: 'unacceptable', scoreBoost: 3, label: 'User described situation as unacceptable' },
  { keyword: 'hours',        scoreBoost: 1, label: 'User referenced time spent on issue' },
  { keyword: 'days',         scoreBoost: 1, label: 'User referenced time spent on issue' },
  { keyword: 'week',         scoreBoost: 1, label: 'User referenced prolonged issue duration' },
  { keyword: 'still',        scoreBoost: 1, label: 'Issue appears to be ongoing/recurring' },
  { keyword: 'again',        scoreBoost: 1, label: 'Issue appears to be recurring' },
];

/**
 * ─── PRIORITY THRESHOLDS ──────────────────────────────────────────────────────
 *
 * The analyzer accumulates a numeric score from category keyword matches
 * and urgency signal boosts. This table maps score ranges to priority tiers.
 *
 * Thresholds are intentionally generous at the low end so that a single
 * strong urgency signal (e.g. "emergency" = +8) can push a ticket to P0
 * even with minimal category keyword matches.
 *
 * Tiers:
 *   P0 – Critical : score >= 15  → Immediate escalation (on-call, SLA breach risk)
 *   P1 – High     : score >= 9   → Same-day response required
 *   P2 – Medium   : score >= 4   → Response within 48 hours
 *   P3 – Low      : score <  4   → Best-effort, no SLA commitment
 */
const PRIORITY_THRESHOLDS = [
  { priority: 'P0', minScore: 15 },
  { priority: 'P1', minScore: 9  },
  { priority: 'P2', minScore: 4  },
  { priority: 'P3', minScore: 0  },
];

/**
 * ─── CUSTOM REFUND RULE ───────────────────────────────────────────────────────
 *
 * Business requirement: Any ticket mentioning a refund must be treated as
 * a Billing issue with at minimum P1 (High) priority, regardless of what
 * the general scoring engine produces.
 *
 * Rationale:
 *   - Refund requests carry financial and legal risk if ignored.
 *   - They may indicate churn risk — a dissatisfied customer who may leave.
 *   - Forcing P1 ensures they always receive same-day attention.
 *
 * This override is applied AFTER all normal scoring is complete,
 * acting as a hard floor rather than influencing the score itself.
 *
 * trigger     — The keyword that activates this rule (case-insensitive)
 * forceCategory — Category that will be set regardless of scoring result
 * forcePriority — Minimum priority floor applied to the ticket
 * signal        — Human-readable explanation stored in ticket.signals
 */
const REFUND_RULE = {
  trigger: 'refund',
  forceCategory: 'Billing',
  forcePriority: 'P1',
  signal: 'Custom rule: refund detected → forced Billing/P1',
};

module.exports = {
  CATEGORY_RULES,
  URGENCY_SIGNALS,
  PRIORITY_THRESHOLDS,
  REFUND_RULE,
};