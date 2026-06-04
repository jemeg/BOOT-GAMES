/**
 * Bot Configuration
 * Loads environment variables and exposes application settings.
 */

require('dotenv').config();

module.exports = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID && process.env.GUILD_ID.length > 0 ? process.env.GUILD_ID : null,

  COLORS: {
    PRIMARY: 0x5865F2,
    SUCCESS: 0x57F287,
    DANGER: 0xED4245,
    WARNING: 0xFEE75C,
    INFO: 0x5865F2,
    DARK: 0x2F3136
  },

  TIMERS: {
    NIGHT: 60,
    DAY: 120,
    VOTING: 40,
    BETWEEN_PHASES: 3000,
    VOTING_WARNING_BEFORE_END_MS: 10000
  }
};
