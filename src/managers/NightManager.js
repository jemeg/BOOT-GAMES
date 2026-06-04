/**
 * NightManager
 * Owns the night phase:
 *   1. Sends role-specific DMs with select menus.
 *   2. Accepts and validates night actions coming from interactions.
 *   3. Resolves the night (kill / save / investigate).
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../config');
const { GameState, Role } = require('../utils/constants');
const { sendDM, delay } = require('../utils/helpers');
const { nightStartEmbed, nightResultEmbed, investigationResultEmbed } = require('../utils/embeds');

class NightManager {
  constructor() {
    /** @type {import('discord.js').Client | null} */
    this.client = null;
  }

  /**
   * @param {import('discord.js').Client} client
   */
  setClient(client) {
    this.client = client;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sending DMs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sends a DM with a select menu to the killer.
   * @param {import('../models/GameSession')} game
   * @param {import('../models/Player')} killer
   */
  async sendKillerDM(game, killer) {
    const targets = game.alivePlayers.filter((p) => p.userId !== killer.userId);
    if (targets.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle('🔪 مرحلة الليل - القاتل')
      .setDescription(
        `مرحباً **${killer.username}**، اختر لاعباً لـ**قتله** الليلة.\n\n` +
          `لديك **${config.TIMERS.NIGHT} ثانية** للقرار.\n` +
          `إذا لم تختر أحداً، ستتخطى هذه الليلة.`
      )
      .setColor(config.COLORS.DANGER)
      .setFooter({ text: `اللعبة: ${game.roomName}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`night_killer_${game.gameId}`)
        .setPlaceholder('اختر ضحية')
        .addOptions(
          targets.map((p) => ({
            label: p.username.slice(0, 90),
            description: `قتل ${p.username}`.slice(0, 95),
            value: p.userId
          }))
        )
    );

    await sendDM(killer.user, { embeds: [embed], components: [row] });
  }

  /**
   * Sends a DM with a select menu to the doctor.
   * @param {import('../models/GameSession')} game
   * @param {import('../models/Player')} doctor
   */
  async sendDoctorDM(game, doctor) {
    const embed = new EmbedBuilder()
      .setTitle('💉 مرحلة الليل - الطبيب')
      .setDescription(
        `مرحباً **${doctor.username}**، اختر لاعباً لـ**حمايته** الليلة.\n\n` +
          `يمكنك حماية نفسك. إذا استهدف القاتل نفس اللاعب، سينجو.\n` +
          `لديك **${config.TIMERS.NIGHT} ثانية** للقرار.`
      )
      .setColor(config.COLORS.SUCCESS)
      .setFooter({ text: `اللعبة: ${game.roomName}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`night_doctor_${game.gameId}`)
        .setPlaceholder('اختر من تريد حمايته')
        .addOptions(
          game.alivePlayers.map((p) => ({
            label: p.username.slice(0, 90),
            description: `حماية ${p.username}`.slice(0, 95),
            value: p.userId
          }))
        )
    );

    await sendDM(doctor.user, { embeds: [embed], components: [row] });
  }

  /**
   * Sends a DM with a select menu to the detective.
   * @param {import('../models/GameSession')} game
   * @param {import('../models/Player')} detective
   */
  async sendDetectiveDM(game, detective) {
    const targets = game.alivePlayers.filter((p) => p.userId !== detective.userId);
    if (targets.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle('🔍 مرحلة الليل - المحقق')
      .setDescription(
        `مرحباً **${detective.username}**، اختر لاعباً لـ**التحقيق معه** الليلة.\n\n` +
          `ستعرف ما إذا كان القاتل أم لا.\n` +
          `لديك **${config.TIMERS.NIGHT} ثانية** للقرار.`
      )
      .setColor(config.COLORS.INFO)
      .setFooter({ text: `اللعبة: ${game.roomName}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`night_detective_${game.gameId}`)
        .setPlaceholder('اختر من تريد التحقيق معه')
        .addOptions(
          targets.map((p) => ({
            label: p.username.slice(0, 90),
            description: `التحقيق مع ${p.username}`.slice(0, 95),
            value: p.userId
          }))
        )
    );

    await sendDM(detective.user, { embeds: [embed], components: [row] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Night phase entry point
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sends the public "night started" embed and DMs all special roles.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   */
  async startNight(game, client) {
    this.setClient(client);
    game.setState(GameState.NIGHT);
    game.currentNight++;
    game.resetNightActions();

    const channel = await client.channels.fetch(game.channelId).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [nightStartEmbed(game)] }).catch(() => null);
    }

    const killers = game.alivePlayers.filter((p) => p.role === Role.KILLER);
    for (const killer of killers) {
      await this.sendKillerDM(game, killer);
    }

    const doctors = game.alivePlayers.filter((p) => p.role === Role.DOCTOR);
    for (const doctor of doctors) {
      await this.sendDoctorDM(game, doctor);
    }

    const detectives = game.alivePlayers.filter((p) => p.role === Role.DETECTIVE);
    for (const detective of detectives) {
      await this.sendDetectiveDM(game, detective);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Action handling
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validates and registers a night action coming from a select menu.
   * @param {import('../models/GameSession')} game
   * @param {'killer' | 'doctor' | 'detective'} actionType
   * @param {string} userId
   * @param {string} targetId
   * @returns {{ success: boolean, error?: string, message?: string }}
   */
  handleNightAction(game, actionType, userId, targetId) {
    if (game.state !== GameState.NIGHT) {
      return { success: false, error: 'ليس وقت الليل حالياً.' };
    }

    const player = game.getPlayer(userId);
    if (!player) return { success: false, error: 'لست مشاركاً في هذه اللعبة.' };
    if (!player.alive) return { success: false, error: 'اللاعبون الموتى لا يستطيعون التصرف.' };

    const target = game.getPlayer(targetId);
    if (!target) return { success: false, error: 'لم يتم العثور على الهدف.' };
    if (!target.alive) return { success: false, error: 'الهدف ميت.' };

    if (actionType === 'killer') {
      if (player.role !== Role.KILLER) {
        return { success: false, error: 'فقط القاتل يستطيع تنفيذ هذا الإجراء.' };
      }
      if (targetId === userId) {
        return { success: false, error: 'لا يمكنك استهداف نفسك.' };
      }
      game.nightActions.killerTarget = targetId;
      game.nightActions.killerUserId = userId;
      player.nightAction = targetId;
      return { success: true, message: `اخترت قتل **${target.username}**.` };
    }

    if (actionType === 'doctor') {
      if (player.role !== Role.DOCTOR) {
        return { success: false, error: 'فقط الطبيب يستطيع تنفيذ هذا الإجراء.' };
      }
      game.nightActions.doctorTarget = targetId;
      game.nightActions.doctorUserId = userId;
      player.nightAction = targetId;
      return { success: true, message: `اخترت حماية **${target.username}**.` };
    }

    if (actionType === 'detective') {
      if (player.role !== Role.DETECTIVE) {
        return { success: false, error: 'فقط المحقق يستطيع تنفيذ هذا الإجراء.' };
      }
      if (targetId === userId) {
        return { success: false, error: 'لا يمكنك التحقيق مع نفسك.' };
      }
      game.nightActions.detectiveTarget = targetId;
      game.nightActions.detectiveUserId = userId;
      player.nightAction = targetId;
      return { success: true, message: `اخترت التحقيق مع **${target.username}**.` };
    }

    return { success: false, error: 'إجراء غير معروف.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resolution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolves the night, applying the kill / save logic and producing the
   * detective investigation DM embed (if any).
   * @param {import('../models/GameSession')} game
   * @returns {Promise<{
   *   killed: import('../models/Player') | null,
   *   saved: boolean,
   *   detectiveResultEmbed: import('discord.js').EmbedBuilder | null,
   *   detectiveUserId: string | null
   * }>}
   */
  async resolveNight(game) {
    const { killerTarget, doctorTarget, detectiveTarget, detectiveUserId } =
      game.nightActions;

    /** @type {import('../models/Player') | null} */
    let killed = null;
    let saved = false;

    if (killerTarget) {
      if (killerTarget === doctorTarget) {
        // Doctor saved the killer's target.
        saved = true;
      } else {
        const target = game.getPlayer(killerTarget);
        if (target && target.alive) {
          game.killPlayer(target);
          killed = target;
        }
      }
    }

    /** @type {EmbedBuilder | null} */
    let detectiveResultEmbed = null;
    if (detectiveTarget && detectiveUserId) {
      const target = game.getPlayer(detectiveTarget);
      if (target) {
        detectiveResultEmbed = investigationResultEmbed(target);
      }
    }

    return {
      killed,
      saved,
      detectiveResultEmbed,
      detectiveUserId
    };
  }

  /**
   * Runs the full night phase: starts night, waits the configured duration,
   * resolves, and posts results in the public channel.
   * @param {import('../models/GameSession')} game
   * @param {import('discord.js').Client} client
   * @returns {Promise<{ killed: any, saved: boolean }>}
   */
  async runNightPhase(game, client) {
    await this.startNight(game, client);

    // OPTIONAL BOT SYSTEM: kick off the bot decision loop in parallel.
    // This block is a no-op if  client.botManager  is missing or disabled,
    // so removing the BotManager automatically disables it.
    let botPromise = null;
    if (client.botManager && client.botManager.isEnabled()) {
      botPromise = client.botManager.processNightActions(game, this);
    }

    // Wait for the night timer.
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, config.TIMERS.NIGHT * 1000);
      game.setTimer('night', timer);
    });

    // Make sure the bot loop finished before we resolve the night.
    if (botPromise) {
      await botPromise.catch(() => null);
    }

    // If the game was force-ended while we were waiting, bail out.
    if (game.isEnded()) {
      return { killed: null, saved: false };
    }

    game.setState(GameState.NIGHT_RESULT);

    const result = await this.resolveNight(game);

    const channel = await client.channels.fetch(game.channelId).catch(() => null);
    if (channel) {
      await channel
        .send({ embeds: [nightResultEmbed(game, result.killed, result.saved)] })
        .catch(() => null);
    }

    if (result.detectiveResultEmbed && result.detectiveUserId) {
      const detective = game.getPlayer(result.detectiveUserId);
      if (detective && detective.alive) {
        await sendDM(detective.user, { embeds: [result.detectiveResultEmbed] });
      }
    }

    await delay(config.TIMERS.BETWEEN_PHASES);
    return { killed: result.killed, saved: result.saved };
  }
}

module.exports = NightManager;
