/**
 * GameManager
 * The central orchestrator:
 *   - holds the in-memory `games` map (multi-room support);
 *   - creates, looks up, and deletes game sessions;
 *   - assigns roles, sends role DMs, and runs the full game loop
 *     (night → day → voting → …) until a winner is decided.
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const config = require('../config');
const { GameState, Role, Team, MIN_PLAYERS } = require('../utils/constants');
const { generateGameId, delay } = require('../utils/helpers');
const { roleDMEmbed, gameEndedEmbed, dayPhaseEmbed, infoEmbed, errorEmbed, lobbyEmbed } = require('../utils/embeds');
const GameSession = require('../models/GameSession');
const RoleManager = require('./RoleManager');
const NightManager = require('./NightManager');
const VoteManager = require('./VoteManager');

class GameManager {
  constructor() {
    /** @type {Map<string, GameSession>} gameId -> session */
    this.games = new Map();
    /** @type {NightManager} */
    this.nightManager = new NightManager();
    /** @type {VoteManager} */
    this.voteManager = new VoteManager();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD on game sessions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Object} options
   * @param {string} options.guildId
   * @param {string} options.channelId
   * @param {string} options.roomName
   * @param {number} options.maxPlayers
   * @param {string} options.creatorId
   * @returns {{ success: boolean, error?: string, game?: GameSession }}
   */
  createGame(options) {
    const { channelId } = options;
    const existing = this.getGameByChannel(channelId);
    if (existing) {
      return { success: false, error: 'A game already exists in this channel.' };
    }

    const gameId = generateGameId();
    const game = new GameSession({ gameId, ...options });
    this.games.set(gameId, game);
    return { success: true, game };
  }

  /**
   * @param {string} gameId
   * @returns {GameSession | undefined}
   */
  getGame(gameId) {
    return this.games.get(gameId);
  }

  /**
   * Returns the active (non-ended) game running in the given channel, if any.
   * @param {string} channelId
   * @returns {GameSession | null}
   */
  getGameByChannel(channelId) {
    for (const game of this.games.values()) {
      if (game.channelId === channelId && game.state !== GameState.ENDED) {
        return game;
      }
    }
    return null;
  }

  /**
   * Returns the active game the user is currently participating in, if any.
   * @param {string} userId
   * @returns {GameSession | null}
   */
  getGameByUser(userId) {
    for (const game of this.games.values()) {
      if (game.state !== GameState.ENDED && game.players.has(userId)) {
        return game;
      }
    }
    return null;
  }

  /**
   * Permanently removes a game from memory and frees its resources.
   * @param {string} gameId
   * @returns {boolean}
   */
  deleteGame(gameId) {
    const game = this.games.get(gameId);
    if (!game) return false;
    game.cleanup();
    this.games.delete(gameId);
    return true;
  }

  /** @returns {GameSession[]} */
  getActiveGames() {
    return Array.from(this.games.values()).filter((g) => g.state !== GameState.ENDED);
  }

  /** @returns {number} */
  getGameCount() {
    return this.games.size;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Starting a game
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validates and starts a game: assigns roles, sends role DMs, and marks
   * the state as `STARTING`. Does NOT run the loop - call `runGameLoop`.
   * @param {string} gameId
   * @param {import('discord.js').Client} client
   * @returns {Promise<{ success: boolean, error?: string, game?: GameSession }>}
   */
  async startGame(gameId, client) {
    const game = this.getGame(gameId);
    if (!game) return { success: false, error: 'لم يتم العثور على اللعبة.' };
    if (game.players.size < MIN_PLAYERS) {
      return { success: false, error: `تحتاج إلى ${MIN_PLAYERS} لاعبين على الأقل لبدء اللعبة.` };
    }
    if (game.isStarted() || game.isEnded()) {
      return { success: false, error: 'اللعبة بدأت بالفعل أو انتهت.' };
    }

    game.setState(GameState.STARTING);

    const playerList = game.getPlayerList();
    RoleManager.assignRoles(playerList);

    // Build alive / dead lists and role counter.
    game.alivePlayers = [...playerList];
    game.deadPlayers = [];
    const roleCounts = RoleManager.countRoles(playerList);
    game.roles = roleCounts;

    // Send each player a private DM with their role.
    for (const player of playerList) {
      try {
        await player.user.send({ embeds: [roleDMEmbed(player)] });
      } catch (err) {
        // DM closed - ignore, the player will simply not know their role.
      }
    }

    // Create temporary voice channel.
    await this.createTempChannel(game, client);

    return { success: true, game };
  }

  /**
   * Creates a temporary voice channel for the game room.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   */
  async createTempChannel(game, client) {
    try {
      const guild = await client.guilds.fetch(game.guildId);
      const textChannel = await guild.channels.fetch(game.channelId).catch(() => null);
      const name = `🎮 ${(game.roomName || 'لعبة مافيا').slice(0, 32)}`;

      const tempRoom = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: textChannel?.parentId ?? null,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      game.tempChannelId = tempRoom.id;
      game.originalChannelId = game.channelId;
      game.channelId = tempRoom.id;

      // Delete the lobby embed (join/leave/start buttons).
      if (game.message) {
        game.message.delete().catch(() => null);
        game.message = null;
      }

      const textChan = textChannel ?? await client.channels.fetch(game.originalChannelId).catch(() => null);
      if (textChan) {
        await textChan
          .send({
            embeds: [
              infoEmbed(
                '📝 غرفة نصية مؤقتة',
                `تم إنشاء غرفة نصية: **${name}**\nاللعبة ستبدأ هناك تلقائياً.`
              )
            ]
          })
          .catch(() => null);
      }
    } catch (err) {
      console.log('Could not create temp voice channel:', err.message);
    }
  }

  /**
   * Deletes the temporary voice channel 10 seconds after the game ends.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   */
  async deleteTempChannel(game, client) {
    if (!game.tempChannelId) return;
    try {
      await delay(10000);
      const channel = await client.channels.fetch(game.tempChannelId).catch(() => null);
      if (channel) {
        await channel.delete('انتهت اللعبة');
      }
    } catch (err) {
      console.log('Could not delete temp voice channel:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Game loop
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Evaluates the win condition for the current state of the game.
   * @param {import('../models/GameSession')} game
   * @returns {{ ended: boolean, winner?: string }}
   */
  checkWinCondition(game) {
    const aliveKillers = game.countAliveByRole(Role.KILLER);
    const aliveOthers = game.alivePlayers.length - aliveKillers;

    if (aliveKillers === 0) {
      return { ended: true, winner: Team.CITIZENS };
    }
    if (aliveKillers >= aliveOthers) {
      return { ended: true, winner: Team.KILLERS };
    }
    return { ended: false };
  }

  /**
   * Runs the day phase (just a timed discussion).
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   */
  async runDayPhase(game, client) {
    game.setState(GameState.DAY);
    game.currentDay++;

    const channel = await client.channels.fetch(game.channelId).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [dayPhaseEmbed(game)] }).catch(() => null);
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, config.TIMERS.DAY * 1000);
      game.setTimer('day', timer);
    });
  }

  /**
   * Ends the game, posts the winner embed, and offers a "Play Again" button.
   * @param {import('../models/GameSession')} game
   * @param {string} winnerTeam
   * @param {import('discord.js').Client} client
   */
  async endGame(game, winnerTeam, client) {
    game.setState(GameState.ENDED);
    game.winner = winnerTeam;
    game.clearAllTimers();

    const tempChannel = await client.channels.fetch(game.channelId).catch(() => null);
    const origChannel = game.originalChannelId
      ? await client.channels.fetch(game.originalChannelId).catch(() => null)
      : tempChannel;

    const embed = gameEndedEmbed(game, winnerTeam);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`playagain_${game.gameId}`)
        .setLabel('العب مجدداً')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔁')
    );

    if (tempChannel) {
      await tempChannel.send({ embeds: [embed] }).catch(() => null);
    }

    if (origChannel && origChannel.id !== game.channelId) {
      await origChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
    } else if (tempChannel) {
      await tempChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
    }

    // Delete temporary voice channel after 10 seconds.
    this.deleteTempChannel(game, client);
  }

  /**
   * Runs the full game loop until a winner is decided.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   */
  async runGameLoop(game, client) {
    try {
      // Brief intro message.
      const introChannel = await client.channels.fetch(game.channelId).catch(() => null);
      if (introChannel) {
        await introChannel
          .send({
            embeds: [
              infoEmbed(
                '🎮 بدأت اللعبة!',
                `تم توزيع الأدوار. تحقق من رسائلك الخاصة لمعرفة مصيرك.\n\n` +
                  `**${game.alivePlayers.length} لاعب** يتنافسون الآن على البقاء.`
              )
            ]
          })
          .catch(() => null);
        await delay(2000);
      }

      // Safety cap so a bug can never infinite-loop the bot.
      const MAX_ROUNDS = 50;
      let round = 0;

      while (round < MAX_ROUNDS) {
        round++;

        // Win check (pre-night).
        const pre = this.checkWinCondition(game);
        if (pre.ended) {
          await this.endGame(game, pre.winner, client);
          return;
        }

        // ── Night phase ──
        await this.nightManager.runNightPhase(game, client);
        if (game.isEnded()) return;

        // Win check (post-night).
        const post = this.checkWinCondition(game);
        if (post.ended) {
          await this.endGame(game, post.winner, client);
          return;
        }

        // ── Day phase ──
        await this.runDayPhase(game, client);
        if (game.isEnded()) return;

        // ── Voting phase ──
        await this.voteManager.runVotingPhase(game, client);
        if (game.isEnded()) return;
      }

      // If we somehow exceed MAX_ROUNDS, end the game as a draw for citizens.
      await this.endGame(game, Team.CITIZENS, client);
    } catch (err) {
      console.error('Game loop error:', err);
      const channel = await client.channels.fetch(game.channelId).catch(() => null);
      if (channel) {
        await channel
          .send({ embeds: [errorEmbed('حدث خطأ غير متوقع. تم إنهاء اللعبة.')] })
          .catch(() => null);
      }
      game.setState(GameState.ENDED);
      game.clearAllTimers();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // "Play Again"
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Re-creates a finished game in the same channel with the same players.
   * @param {string} oldGameId
   * @param {import('discord.js').Client} client
   * @returns {Promise<{ success: boolean, error?: string, game?: GameSession }>}
   */
  async playAgain(oldGameId, client) {
    const oldGame = this.getGame(oldGameId);
    if (!oldGame) return { success: false, error: 'لم يتم العثور على اللعبة الأصلية.' };
    if (!oldGame.isEnded()) {
      return { success: false, error: 'اللعبة السابقة لم تنتهِ بعد.' };
    }

    const result = this.createGame({
      guildId: oldGame.guildId,
      channelId: oldGame.originalChannelId ?? oldGame.channelId,
      roomName: oldGame.roomName,
      maxPlayers: oldGame.maxPlayers,
      creatorId: oldGame.creatorId
    });

    if (!result.success) return { success: false, error: result.error };

    const newGame = result.game;

    // Re-insert the previous players.
    for (const oldPlayer of oldGame.players.values()) {
      const addResult = newGame.addPlayer(oldPlayer.user);
      if (!addResult.success) {
        console.warn(`Failed to re-add ${oldPlayer.username} to new game: ${addResult.error}`);
      }
    }

    // Post the lobby embed with join/leave/start buttons.
    const channel = await client.channels
      .fetch(newGame.channelId)
      .catch(() => null);

    if (channel) {
      const {
        ActionRowBuilder: ARB,
        ButtonBuilder: BB,
        ButtonStyle: BS
      } = require('discord.js');

      const row = new ARB().addComponents(
        new BB().setCustomId(`join_${newGame.gameId}`).setLabel('انضمام').setStyle(BS.Success).setEmoji('➕'),
        new BB().setCustomId(`leave_${newGame.gameId}`).setLabel('مغادرة').setStyle(BS.Danger).setEmoji('➖'),
        new BB().setCustomId(`startbtn_${newGame.gameId}`).setLabel('بدء').setStyle(BS.Primary).setEmoji('▶️')
      );

      const message = await channel
        .send({ embeds: [lobbyEmbed(newGame)], components: [row] })
        .catch(() => null);
      if (message) newGame.message = message;
    }

    return { success: true, game: newGame };
  }
}

module.exports = GameManager;
