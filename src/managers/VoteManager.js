/**
 * VoteManager
 * Owns the voting phase:
 *   1. Sends the public voting embed with a select menu.
 *   2. Accepts and validates votes.
 *   3. Tallies votes, executes the highest-voted player, and reports results.
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../config');
const { GameState } = require('../utils/constants');
const { votingEmbed, executionEmbed } = require('../utils/embeds');
const { pickRandom, delay } = require('../utils/helpers');

class VoteManager {
  /**
   * Sends a "10 seconds left!" warning embed into the game channel.
   * Skipped silently if the channel can't be fetched.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   * @param {number} remainingMs
   */
  async _sendVotingWarning(game, client, remainingMs) {
    const channel = await client.channels.fetch(game.channelId).catch(() => null);
    if (!channel) return;

    const seconds = Math.max(1, Math.round(remainingMs / 1000));

    const embed = new EmbedBuilder()
      .setTitle('⏳ تنبيه: تبقى ' + seconds + ' ثانية!')
      .setDescription(
        `**اقترب وقت التصويت من الانتهاء!**\n` +
          `صوّت الآن إن لم تكن قد صوّت.\n` +
          `الأصوات الحالية: **${game.votes.size} / ${game.alivePlayers.length}**`
      )
      .setColor(config.COLORS.WARNING)
      .setFooter({ text: '⏰ لن تنتظر أصواتاً إضافية بعد هذا التنبيه' })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Sends the voting embed + select menu into the game channel.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   */
  async startVoting(game, client) {
    game.setState(GameState.VOTING);
    game.resetVotes();

    const channel = await client.channels.fetch(game.channelId).catch(() => null);
    if (!channel) return;

    const embed = votingEmbed(game);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`vote_${game.gameId}`)
        .setPlaceholder('اختر اللاعب الذي تريد التصويت ضده')
        .addOptions(
          game.alivePlayers.map((p) => ({
            label: p.username.slice(0, 90),
            description: `التصويت ضد ${p.username}`.slice(0, 95),
            value: p.userId
          }))
        )
    );

    await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
  }

  /**
   * Validates and registers a vote.
   * @param {import('../models/GameSession')} game
   * @param {string} voterId
   * @param {string} targetId
   * @returns {{ success: boolean, error?: string, message?: string }}
   */
  handleVote(game, voterId, targetId) {
    if (game.state !== GameState.VOTING) {
      return { success: false, error: 'ليس وقت التصويت حالياً.' };
    }

    const voter = game.getPlayer(voterId);
    if (!voter) return { success: false, error: 'لست مشاركاً في هذه اللعبة.' };
    if (!voter.alive) return { success: false, error: 'اللاعبون الموتى لا يستطيعون التصويت.' };

    const target = game.getPlayer(targetId);
    if (!target) return { success: false, error: 'لم يتم العثور على الهدف.' };
    if (!target.alive) return { success: false, error: 'لا يمكنك التصويت للاعب ميت.' };

    if (targetId === voterId) {
      return { success: false, error: 'لا يمكنك التصويت لنفسك.' };
    }

    voter.vote = targetId;
    game.votes.set(voterId, targetId);
    return { success: true, message: `صوّتَّ لـ **${target.username}**.` };
  }

  /**
   * Tallies the votes and returns the player to be executed (if any).
   * @param {import('../models/GameSession')} game
   * @returns {{
   *   executed: import('../models/Player') | null,
   *   tally: Map<string, number>,
   *   noVotes: boolean
   * }}
   */
  resolveVotes(game) {
    /** @type {Map<string, number>} */
    const tally = new Map();
    for (const [voterId, targetId] of game.votes) {
      const voter = game.getPlayer(voterId);
      if (!voter || !voter.alive) continue;
      tally.set(targetId, (tally.get(targetId) || 0) + 1);
    }

    if (tally.size === 0) {
      return { executed: null, tally, noVotes: true };
    }

    let maxVotes = 0;
    /** @type {string[]} */
    let tied = [];
    for (const [userId, votes] of tally) {
      if (votes > maxVotes) {
        maxVotes = votes;
        tied = [userId];
      } else if (votes === maxVotes) {
        tied.push(userId);
      }
    }

    const chosenId = pickRandom(tied);
    const executed = game.getPlayer(chosenId) || null;
    if (executed) game.killPlayer(executed);

    return { executed, tally, noVotes: false };
  }

  /**
   * Runs the full voting phase end-to-end.
   * Sends a "10 seconds left!" warning embed when the timer is about to end.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   * @returns {Promise<{ executed: import('../models/Player') | null, noVotes: boolean }>}
   */
  async runVotingPhase(game, client) {
    await this.startVoting(game, client);

    // OPTIONAL BOT SYSTEM: bots cast their votes in parallel with real players.
    // No-op if  client.botManager  is missing or disabled.
    let botPromise = null;
    if (client.botManager && client.botManager.isEnabled()) {
      botPromise = client.botManager.processVotes(game, this);
    }

    // Split the wait into two phases: (total - warning) then (warning).
    const totalMs = config.TIMERS.VOTING * 1000;
    const warningMs = Math.min(
      config.TIMERS.VOTING_WARNING_BEFORE_END_MS || 10000,
      Math.max(0, totalMs - 1000) // never warn during the very last second
    );
    const mainMs = Math.max(0, totalMs - warningMs);

    // ── Main wait ──
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, mainMs);
      game.setTimer('voting', timer);
    });

    // Only post the warning if the game is still actively in voting.
    if (!game.isEnded() && game.state === 'VOTING') {
      await this._sendVotingWarning(game, client, warningMs);

      // ── Final wait (warning window) ──
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, warningMs);
        game.setTimer('voting', timer);
      });
    }

    if (botPromise) {
      await botPromise.catch(() => null);
    }

    if (game.isEnded()) {
      return { executed: null, noVotes: true };
    }

    const result = this.resolveVotes(game);

    const channel = await client.channels.fetch(game.channelId).catch(() => null);
    if (channel) {
      let embed;
      if (result.executed) {
        embed = executionEmbed(game, result.executed);
      } else {
        embed = new EmbedBuilder()
          .setTitle('⚖️ لم يحدث تنفيذ')
          .setDescription('لم يتم الإدلاء بأي صوت. لم يُعدم أحد اليوم.')
          .setColor(config.COLORS.WARNING)
          .addFields(
            { name: '💚 أحياء', value: `${game.alivePlayers.length}`, inline: true },
            { name: '💀 موتى', value: `${game.deadPlayers.length}`, inline: true }
          )
          .setTimestamp();
      }
      await channel.send({ embeds: [embed] }).catch(() => null);
    }

    await delay(config.TIMERS.BETWEEN_PHASES);
    return { executed: result.executed, noVotes: result.noVotes };
  }
}

module.exports = VoteManager;
