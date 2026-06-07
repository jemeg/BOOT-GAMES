/**
 * GameSession Model
 * Represents a single Mafia / Killer game running in a Discord channel.
 * Holds the entire state machine, players, votes, night actions, and timers.
 */

const { GameState, Role } = require('../utils/constants');
const Player = require('./Player');

class GameSession {
  /**
   * @param {Object} options
   * @param {string} options.gameId
   * @param {string} options.guildId
   * @param {string} options.channelId
   * @param {string} options.roomName
   * @param {number} options.maxPlayers
   * @param {string} options.creatorId
   */
  constructor({ gameId, guildId, channelId, roomName, maxPlayers, creatorId }) {
    /** @type {string} */
    this.gameId = gameId;
    /** @type {string} */
    this.guildId = guildId;
    /** @type {string} */
    this.channelId = channelId;
    /** @type {string} */
    this.roomName = roomName;
    /** @type {number} */
    this.maxPlayers = maxPlayers;
    /** @type {string} */
    this.creatorId = creatorId;

    /** @type {string} */
    this.state = GameState.WAITING;

    /** @type {Map<string, Player>} */
    this.players = new Map();
    /** @type {Player[]} */
    this.alivePlayers = [];
    /** @type {Player[]} */
    this.deadPlayers = [];

    /** @type {Object<string, number>} */
    this.roles = {
      [Role.KILLER]: 0,
      [Role.DOCTOR]: 0,
      [Role.DETECTIVE]: 0,
      [Role.CITIZEN]: 0
    };

    /** @type {Map<string, string>} voterId -> targetId */
    this.votes = new Map();

    /** @type {string|null} ID of the temporary voice channel */
    this.tempChannelId = null;

    /** @type {string|null} ID of the original text channel before redirecting to temp channel */
    this.originalChannelId = null;

    /** @type {Object} night actions for the current night */
    this.nightActions = {
      killerTarget: null,
      killerUserId: null,
      doctorTarget: null,
      doctorUserId: null,
      detectiveTarget: null,
      detectiveUserId: null
    };

    /** @type {Object<string, NodeJS.Timeout | null>} */
    this.timers = {
      night: null,
      day: null,
      voting: null,
      between: null
    };

    /** @type {number} */
    this.createdAt = Date.now();
    /** @type {number} */
    this.currentDay = 0;
    /** @type {number} */
    this.currentNight = 0;
    /** @type {string | null} */
    this.winner = null;
    /** @type {import('discord.js').Message | null} */
    this.message = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Player management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adds a user to the game.
   * @param {import('discord.js').User} user
   * @returns {{ success: boolean, error?: string, player?: Player }}
   */
  addPlayer(user) {
    if (this.players.has(user.id)) {
      return { success: false, error: 'You are already in this game.' };
    }
    if (this.players.size >= this.maxPlayers) {
      return { success: false, error: 'The game is full.' };
    }
    if (this.state !== GameState.WAITING) {
      return { success: false, error: 'The game has already started.' };
    }

    const player = new Player(user);
    this.players.set(user.id, player);
    return { success: true, player };
  }

  /**
   * Removes a player before the game has started.
   * @param {string} userId
   * @returns {{ success: boolean, error?: string }}
   */
  removePlayer(userId) {
    if (this.state !== GameState.WAITING) {
      return { success: false, error: 'The game has already started.' };
    }
    if (!this.players.has(userId)) {
      return { success: false, error: 'You are not in this game.' };
    }
    this.players.delete(userId);
    return { success: true };
  }

  /**
   * @param {string} userId
   * @returns {Player | undefined}
   */
  getPlayer(userId) {
    return this.players.get(userId);
  }

  /**
   * @param {string} userId
   * @returns {boolean}
   */
  hasPlayer(userId) {
    return this.players.has(userId);
  }

  /**
   * @returns {Player[]}
   */
  getPlayerList() {
    return Array.from(this.players.values());
  }

  /**
   * @returns {Player[]}
   */
  getAlivePlayers() {
    return this.alivePlayers;
  }

  /**
   * @returns {Player[]}
   */
  getDeadPlayers() {
    return this.deadPlayers;
  }

  /**
   * Kills a player and moves them to the dead list.
   * @param {Player} player
   */
  killPlayer(player) {
    if (!player.alive) return;
    player.kill();
    this.alivePlayers = this.alivePlayers.filter((p) => p.userId !== player.userId);
    if (!this.deadPlayers.find((p) => p.userId === player.userId)) {
      this.deadPlayers.push(player);
    }
  }

  /**
   * @param {string} role
   * @returns {number}
   */
  countAliveByRole(role) {
    return this.alivePlayers.filter((p) => p.role === role).length;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} state
   */
  setState(state) {
    this.state = state;
  }

  /**
   * @returns {boolean}
   */
  isStarted() {
    return this.state !== GameState.WAITING && this.state !== GameState.ENDED;
  }

  /**
   * @returns {boolean}
   */
  isEnded() {
    return this.state === GameState.ENDED;
  }

  /**
   * @returns {boolean}
   */
  isFull() {
    return this.players.size >= this.maxPlayers;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Round reset
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clears all votes (called when entering voting phase).
   */
  resetVotes() {
    this.votes.clear();
    for (const player of this.players.values()) {
      player.vote = null;
    }
  }

  /**
   * Clears all night actions (called when entering night phase).
   */
  resetNightActions() {
    this.nightActions.killerTarget = null;
    this.nightActions.killerUserId = null;
    this.nightActions.doctorTarget = null;
    this.nightActions.doctorUserId = null;
    this.nightActions.detectiveTarget = null;
    this.nightActions.detectiveUserId = null;
    for (const player of this.players.values()) {
      player.nightAction = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Timers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Stores a timer reference, clearing any existing one with the same key.
   * @param {string} key
   * @param {NodeJS.Timeout} timer
   */
  setTimer(key, timer) {
    if (this.timers[key]) {
      clearTimeout(this.timers[key]);
    }
    this.timers[key] = timer;
  }

  /**
   * Clears a specific timer.
   * @param {string} key
   */
  clearTimer(key) {
    if (this.timers[key]) {
      clearTimeout(this.timers[key]);
      this.timers[key] = null;
    }
  }

  /**
   * Clears every active timer.
   */
  clearAllTimers() {
    for (const key of Object.keys(this.timers)) {
      this.clearTimer(key);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Frees all internal resources. Call when the game is permanently over.
   */
  cleanup() {
    this.clearAllTimers();
    this.votes.clear();
    this.resetNightActions();
    this.players.clear();
    this.alivePlayers = [];
    this.deadPlayers = [];
  }

  /**
   * Lightweight serialisation for logging/debug.
   */
  toJSON() {
    return {
      gameId: this.gameId,
      guildId: this.guildId,
      channelId: this.channelId,
      roomName: this.roomName,
      state: this.state,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      aliveCount: this.alivePlayers.length,
      deadCount: this.deadPlayers.length,
      currentDay: this.currentDay,
      currentNight: this.currentNight
    };
  }
}

module.exports = GameSession;
