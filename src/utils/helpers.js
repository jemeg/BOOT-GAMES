/**
 * Helper Utilities
 * Small reusable functions used throughout the project.
 */

/**
 * Returns a new shuffled copy of the given array (Fisher-Yates).
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Formats seconds into a friendly mm:ss string.
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.floor(seconds % 60));
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Resolves after the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a unique-enough id for a game session.
 * @returns {string}
 */
function generateGameId() {
  return (
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36)
  );
}

/**
 * Picks a random element from a non-empty array.
 * @template T
 * @param {T[]} array
 * @returns {T}
 */
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Sends a DM to a user, gracefully handling closed DMs.
 * @param {import('discord.js').User} user
 * @param {import('discord.js').MessageCreateOptions | import('discord.js').MessageEditOptions} options
 * @returns {Promise<import('discord.js').Message | null>}
 */
async function sendDM(user, options) {
  try {
    return await user.send(options);
  } catch (err) {
    return null;
  }
}

module.exports = {
  shuffle,
  formatTime,
  delay,
  generateGameId,
  pickRandom,
  sendDM
};
