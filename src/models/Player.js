/**
 * Player Model
 * Represents a single user participating in a Mafia / Killer game session.
 */

class Player {
  /**
   * @param {import('discord.js').User} user Discord user object.
   */
  constructor(user) {
    /** @type {string} */
    this.userId = user.id;
    /** @type {string} */
    this.username = user.username;
    /** @type {import('discord.js').User} */
    this.user = user;
    /** @type {string | null} */
    this.role = null;
    /** @type {boolean} */
    this.alive = true;
    /** @type {string | null} */
    this.vote = null;
    /** @type {string | null} */
    this.nightAction = null;
  }

  /**
   * Assigns a role to the player.
   * @param {string} role One of the values in `Role`.
   */
  setRole(role) {
    this.role = role;
  }

  /**
   * Marks the player as dead.
   */
  kill() {
    this.alive = false;
  }

  /**
   * Resets transient per-round state (votes / night actions).
   */
  reset() {
    this.vote = null;
    this.nightAction = null;
  }

  /**
   * @param {string} role
   * @returns {boolean}
   */
  hasRole(role) {
    return this.role === role;
  }
}

module.exports = Player;
