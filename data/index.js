/**
 * Data Layer - In-Memory Store
 *
 * A thin abstraction over the bot's in-memory state. The current
 * implementation simply re-exports the GameManager's `games` map; this file
 * exists so that the rest of the codebase talks to a stable API
 * (`data.getStore()`) that can later be swapped for a real database
 * (MongoDB, PostgreSQL, Redis, …) without touching the managers.
 */

const config = require('./config');

/**
 * @typedef {Object} DataStore
 * @property {typeof config} settings  The current game configuration.
 * @property {() => number} gameCount  Number of tracked games.
 * @property {() => any[]} listGames   List of all live game objects.
 */

/**
 * Returns the active data store. The shape is identical regardless of the
 * underlying storage backend.
 *
 * @param {import('../src/managers/GameManager')} gameManager
 * @returns {DataStore}
 */
function getStore(gameManager) {
  return {
    settings: config,
    gameCount: () => gameManager.getGameCount(),
    listGames: () => gameManager.getActiveGames()
  };
}

module.exports = {
  config,
  getStore
};
