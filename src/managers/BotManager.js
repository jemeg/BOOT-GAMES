/**
 * BotManager
 *
 * Drop-in module that lets a single human test the game alone by
 * populating the lobby with simulated players ("bots").
 *
 * ── How to REMOVE this system ──────────────────────────────────────────
 *   1. Delete this file.
 *   2. Delete  src/commands/addBots.js  and  src/commands/removeBots.js
 *   3. In  src/index.js  remove the line  client.botManager = new BotManager();
 *   4. In  src/managers/NightManager.js  and  src/managers/VoteManager.js
 *      remove the  `if (client.botManager && client.botManager.isEnabled())`
 *      blocks (or just leave them - they will safely no-op once the
 *      manager is gone).
 *   5. Set  data/config.js -> BOTS.ENABLED = false  if you want a soft kill.
 * ─────────────────────────────────────────────────────────────────────────
 */

const { delay, pickRandom } = require('../utils/helpers');
const { Role } = require('../utils/constants');
const dataConfig = require('../../data/config');

class BotManager {
  constructor() {
    /** @type {boolean} Toggle the whole feature on/off without removing files. */
    this.enabled = dataConfig.BOTS.ENABLED;
    /** Auto-incrementing id used for unique bot usernames. */
    this._counter = 0;
  }

  /** @returns {boolean} */
  isEnabled() {
    return this.enabled;
  }

  /** @param {boolean} value */
  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Mock Discord user
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Builds a fake Discord `User`-shaped object that the rest of the codebase
   * (which only ever calls `user.username` and `user.send()`) can use
   * transparently.
   * @returns {{ id: string, username: string, bot: true, send: Function }}
   */
  _createBotUser() {
    this._counter += 1;
    const id = `bot_${this._counter.toString().padStart(3, '0')}_${Date.now().toString(36)}`;
    const username = `Bot ${this._counter}`;

    return {
      id,
      username,
      bot: true,
      /**
       * Mock `user.send()` - the real helper `sendDM` swallows errors
       * and returns `null`, so we just log and pretend it worked.
       */
      send: async (options) => {
        const title = options?.embeds?.[0]?.title || '(no title)';
        const desc = options?.embeds?.[0]?.description || '';
        console.log(`\n🤖 [BOT DM → ${username}] ${title}`);
        if (desc) {
          console.log('   ' + desc.split('\n')[0].slice(0, 100));
        }
        return {
          id: 'mock_msg_' + Date.now(),
          author: { id, username, bot: true },
          content: '',
          embeds: options?.embeds || [],
          mock: true
        };
      }
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Lobby management
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Adds `count` bots to the lobby.
   * @param {import('../models/GameSession')} game
   * @param {number} count
   * @returns {{ success: boolean, error?: string, added: number }}
   */
  addBotsToGame(game, count) {
    if (!this.isEnabled()) {
      return { success: false, error: 'Bot system is disabled.', added: 0 };
    }
    if (!game) return { success: false, error: 'Game not found.', added: 0 };
    if (game.state !== 'WAITING') {
      return { success: false, error: 'The game has already started.', added: 0 };
    }

    let added = 0;
    for (let i = 0; i < count; i++) {
      if (game.players.size >= game.maxPlayers) break;
      const botUser = this._createBotUser();
      const result = game.addPlayer(botUser);
      if (result.success) added++;
    }

    console.log(`🤖 [BotManager] Added ${added} bot(s) to game ${game.gameId}.`);
    return { success: true, added };
  }

  /**
   * Removes every bot currently in the lobby.
   * @param {import('../models/GameSession')} game
   * @returns {{ success: boolean, error?: string, removed: number }}
   */
  removeAllBots(game) {
    if (!this.isEnabled()) {
      return { success: false, error: 'Bot system is disabled.', removed: 0 };
    }
    if (!game) return { success: false, error: 'Game not found.', removed: 0 };
    if (game.state !== 'WAITING') {
      return { success: false, error: 'The game has already started.', removed: 0 };
    }

    let removed = 0;
    for (const [userId, player] of Array.from(game.players.entries())) {
      if (player.user && player.user.bot) {
        game.players.delete(userId);
        removed++;
      }
    }

    console.log(`🤖 [BotManager] Removed ${removed} bot(s) from game ${game.gameId}.`);
    return { success: true, removed };
  }

  /** @param {import('../models/GameSession')} game */
  getAliveBots(game) {
    return game.alivePlayers.filter((p) => p.user && p.user.bot);
  }

  /** @param {import('../models/GameSession')} game */
  getAllBots(game) {
    return Array.from(game.players.values()).filter((p) => p.user && p.user.bot);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Decision helpers
  // ───────────────────────────────────────────────────────────────────────

  /**
   * @param {import('../models/GameSession')} game
   * @param {import('../models/Player')} bot
   * @param {import('./NightManager')} nightManager
   */
  _makeNightDecision(game, bot, nightManager) {
    if (bot.role === Role.KILLER) {
      const targets = game.alivePlayers.filter((p) => p.userId !== bot.userId);
      if (targets.length === 0) return;
      const target = pickRandom(targets);
      const r = nightManager.handleNightAction(game, 'killer', bot.userId, target.userId);
      console.log(`🤖 [${bot.username}/Killer] → ${target.username}  ${r.success ? '✓' : '✗ ' + r.error}`);
    } else if (bot.role === Role.DOCTOR) {
      const targets = game.alivePlayers; // doctor can self-protect
      if (targets.length === 0) return;
      const target = pickRandom(targets);
      const r = nightManager.handleNightAction(game, 'doctor', bot.userId, target.userId);
      console.log(`🤖 [${bot.username}/Doctor] → protect ${target.username}  ${r.success ? '✓' : '✗ ' + r.error}`);
    } else if (bot.role === Role.DETECTIVE) {
      const targets = game.alivePlayers.filter((p) => p.userId !== bot.userId);
      if (targets.length === 0) return;
      const target = pickRandom(targets);
      const r = nightManager.handleNightAction(game, 'detective', bot.userId, target.userId);
      console.log(`🤖 [${bot.username}/Detective] → investigate ${target.username}  ${r.success ? '✓' : '✗ ' + r.error}`);
    } else {
      // Citizens don't have night actions - no-op.
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Phase processing
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Loops through every alive bot and lets them pick a night action.
   * Returns a Promise that resolves once all bots have either acted,
   * skipped, or the night state has changed.
   * @param {import('../models/GameSession')} game
   * @param {import('./NightManager')} nightManager
   */
  async processNightActions(game, nightManager) {
    if (!this.isEnabled()) return;
    const aliveBots = this.getAliveBots(game);
    if (aliveBots.length === 0) return;

    const cfg = dataConfig.BOTS;
    const minD = cfg.NIGHT_MIN_DELAY_MS;
    const maxD = cfg.NIGHT_MAX_DELAY_MS;
    const skipChance = cfg.SKIP_CHANCE;

    for (const bot of aliveBots) {
      if (game.state !== 'NIGHT') return;
      await delay(minD + Math.random() * (maxD - minD));
      if (game.state !== 'NIGHT') return;
      if (Math.random() < skipChance) {
        console.log(`🤖 [${bot.username}] skipped this night.`);
        continue;
      }
      this._makeNightDecision(game, bot, nightManager);
    }
  }

  /**
   * Loops through every alive bot and casts a random vote.
   * @param {import('../models/GameSession')} game
   * @param {import('./VoteManager')} voteManager
   */
  async processVotes(game, voteManager) {
    if (!this.isEnabled()) return;
    const aliveBots = this.getAliveBots(game);
    if (aliveBots.length === 0) return;

    const cfg = dataConfig.BOTS;
    const minD = cfg.VOTE_MIN_DELAY_MS;
    const maxD = cfg.VOTE_MAX_DELAY_MS;

    for (const bot of aliveBots) {
      if (game.state !== 'VOTING') return;
      await delay(minD + Math.random() * (maxD - minD));
      if (game.state !== 'VOTING') return;

      const targets = game.alivePlayers.filter((p) => p.userId !== bot.userId);
      if (targets.length === 0) continue;
      const target = pickRandom(targets);
      const r = voteManager.handleVote(game, bot.userId, target.userId);
      console.log(`🤖 [${bot.username}] voted for ${target.username}  ${r.success ? '✓' : '✗ ' + r.error}`);
    }
  }
}

module.exports = BotManager;
