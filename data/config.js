/**
 * Data Layer - Game Settings
 *
 * Default configuration for the game itself. Currently used as a single
 * source of truth for tunable values. In the future this can be backed by
 * a real database (e.g. MongoDB, PostgreSQL) by swapping the implementation
 * inside `data/index.js`.
 */

module.exports = {
  TIMERS: {
    NIGHT: 60,
    DAY: 120,
    VOTING: 40,
    BETWEEN_PHASES: 3000,
    VOTING_WARNING_BEFORE_END_MS: 10000
  },

  LIMITS: {
    MIN_PLAYERS: 4,
    MAX_PLAYERS: 10
  },

  ROLE_DISTRIBUTION: {
    4:  { killer: 1, doctor: 0, detective: 0, citizen: 3 },
    5:  { killer: 1, doctor: 0, detective: 0, citizen: 4 },
    6:  { killer: 1, doctor: 1, detective: 0, citizen: 4 },
    7:  { killer: 2, doctor: 1, detective: 0, citizen: 4 },
    8:  { killer: 2, doctor: 1, detective: 0, citizen: 5 },
    9:  { killer: 2, doctor: 2, detective: 1, citizen: 4 },
    10: { killer: 2, doctor: 2, detective: 1, citizen: 5 },
    11: { killer: 2, doctor: 2, detective: 1, citizen: 6 },
    12: { killer: 2, doctor: 2, detective: 1, citizen: 7 },
    13: { killer: 2, doctor: 2, detective: 2, citizen: 7 },
    14: { killer: 2, doctor: 2, detective: 2, citizen: 8 },
    15: { killer: 3, doctor: 3, detective: 2, citizen: 7 },
    16: { killer: 3, doctor: 3, detective: 2, citizen: 8 },
    17: { killer: 3, doctor: 3, detective: 2, citizen: 9 },
    18: { killer: 3, doctor: 3, detective: 2, citizen: 10 },
    19: { killer: 3, doctor: 3, detective: 2, citizen: 11 },
    20: { killer: 4, doctor: 4, detective: 2, citizen: 10 },
    99: { killer: 10, doctor: 10, detective: 8, citizen: 71 },
  },

  COLORS: {
    PRIMARY: 0x5865f2,
    SUCCESS: 0x57f287,
    DANGER:  0xed4245,
    WARNING: 0xfee75c,
    INFO:    0x5865f2,
    DARK:    0x2f3136
  },

  // ─────────────────────────────────────────────────────────────────────
  // Bot system configuration.
  // Set ENABLED to false (or just delete the BotManager + bot commands) to
  // completely remove the bot-testing feature.
  // ─────────────────────────────────────────────────────────────────────
  BOTS: {
    ENABLED: true,
    SKIP_CHANCE: 0.3,             // % chance a bot skips its night action
    NIGHT_MIN_DELAY_MS: 1500,     // bot "thinking" delay range
    NIGHT_MAX_DELAY_MS: 5500,
    VOTE_MIN_DELAY_MS: 600,
    VOTE_MAX_DELAY_MS: 2800
  }
};
