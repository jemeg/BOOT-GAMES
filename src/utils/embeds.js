/**
 * Embed Builders
 * Centralized Discord Embed construction - all user-facing text in Arabic.
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { GameState, Role, RoleEmoji, RoleDescription, Team, StateDisplay } = require('./constants');
const { formatTime } = require('./helpers');

/**
 * Resolves the Arabic display name for a game state.
 * @param {string} state
 * @returns {string}
 */
function stateName(state) {
  return StateDisplay[state] || state;
}

/**
 * Initial "create-game" embed.
 * @param {import('../models/GameSession')} game
 * @returns {EmbedBuilder}
 */
function createGameEmbed(game) {
  return new EmbedBuilder()
    .setTitle(`🎭 ${game.roomName}`)
    .setDescription(
      '**تم إنشاء لعبة مافيا جديدة!**\n\n' +
        '• اضغط زر **انضمام** أدناه أو استخدم `/join` للمشاركة.\n' +
        '• استخدم `/add-bots` لإضافة لاعبين وهميين (للاختبار الفردي).\n' +
        '• استخدم `/start` عندما يكتمل العدد (الحد الأدنى 4 لاعبين).'
    )
    .setColor(config.COLORS.PRIMARY)
    .addFields(
      { name: '📊 الحالة', value: `\`${stateName(game.state)}\``, inline: true },
      { name: '👥 اللاعبون', value: `${game.players.size} / ${game.maxPlayers}`, inline: true },
      { name: '🎯 معرّف اللعبة', value: `\`${game.gameId}\``, inline: true }
    )
    .setFooter({ text: 'بوت مافيا / القاتل' })
    .setTimestamp();
}

/**
 * Lobby embed (with player list).
 * @param {import('../models/GameSession')} game
 * @returns {EmbedBuilder}
 */
function lobbyEmbed(game) {
  const players = Array.from(game.players.values());
  const playerList = players.length
    ? players
        .map((p, i) => {
          const isBot = !!(p.user && p.user.bot);
          return `${i + 1}. **${p.username}**${isBot ? ' 🤖' : ''}`;
        })
        .join('\n')
    : '_لا يوجد لاعبون بعد._';

  const botCount = players.filter((p) => p.user && p.user.bot).length;
  const realCount = players.length - botCount;

  const fields = [
    { name: '📊 الحالة', value: `\`${stateName(game.state)}\``, inline: true },
    { name: '👥 اللاعبون', value: `${game.players.size} / ${game.maxPlayers}`, inline: true },
    { name: '⏱️ الحد الأدنى', value: `${require('./constants').MIN_PLAYERS}`, inline: true }
  ];

  if (botCount > 0) {
    fields.push({
      name: '🤖 البوتات',
      value: `${botCount} بوت · ${realCount} لاعب حقيقي`,
      inline: true
    });
  }

  return new EmbedBuilder()
    .setTitle(`🎭 ${game.roomName} - اللوبي`)
    .setDescription(`**اللاعبون في اللوبي:**\n${playerList}`)
    .setColor(config.COLORS.PRIMARY)
    .addFields(fields)
    .setFooter({ text: `معرّف اللعبة: ${game.gameId}` })
    .setTimestamp();
}

/**
 * Role assignment DM embed.
 * @param {import('../models/Player')} player
 * @returns {EmbedBuilder}
 */
function roleDMEmbed(player) {
  return new EmbedBuilder()
    .setTitle(`دورك: ${RoleEmoji[player.role]} ${player.role}`)
    .setDescription(RoleDescription[player.role])
    .setColor(config.COLORS.PRIMARY)
    .addFields({
      name: '⚠️ تنبيه',
      value: '**احتفظ بدورك سراً!**\nلا تكشف عنه أبداً في القنوات العامة.'
    })
    .setFooter({ text: 'بوت مافيا / القاتل' })
    .setTimestamp();
}

/**
 * Night-phase announcement embed.
 * @param {import('../models/GameSession')} game
 * @returns {EmbedBuilder}
 */
function nightStartEmbed(game) {
  return new EmbedBuilder()
    .setTitle('🌙 مرحلة الليل')
    .setDescription(
      'لقد حلّ الليل... المدينة نائمة.\n\n' +
        'على الأدوار الخاصة مراجعة الرسائل الخاصة (DM) واتخاذ قراراتهم.'
    )
    .setColor(config.COLORS.DARK)
    .addFields(
      { name: '⏱️ الوقت', value: `${config.TIMERS.NIGHT} ثانية`, inline: true },
      { name: '💚 أحياء', value: `${game.alivePlayers.length}`, inline: true },
      { name: '💀 موتى', value: `${game.deadPlayers.length}`, inline: true }
    )
    .setTimestamp();
}

/**
 * Night-result public embed.
 * @param {import('../models/GameSession')} game
 * @param {import('../models/Player') | null} killed
 * @param {boolean} saved
 * @returns {EmbedBuilder}
 */
function nightResultEmbed(game, killed, saved) {
  let description;
  if (saved) {
    description = '🛡️ **الطبيب أنقذ أحدهم!**\nلم يمت أحد الليلة.';
  } else if (killed) {
    description = `💀 **${killed.username}** قُتل الليلة.\n\nسيُكشف عن دوره بعد ذلك...`;
  } else {
    description = '🌫️ مرّ الليل بسلام. لم يمت أحد.';
  }
  return new EmbedBuilder()
    .setTitle('🌙 نتائج الليل')
    .setDescription(description)
    .setColor(saved ? config.COLORS.SUCCESS : config.COLORS.DANGER)
    .addFields(
      { name: '💚 أحياء', value: `${game.alivePlayers.length}`, inline: true },
      { name: '💀 موتى', value: `${game.deadPlayers.length}`, inline: true }
    )
    .setTimestamp();
}

/**
 * Detective investigation result embed (sent via DM).
 * @param {import('../models/Player')} target
 * @returns {EmbedBuilder}
 */
function investigationResultEmbed(target) {
  const isKiller = target.role === Role.KILLER;
  return new EmbedBuilder()
    .setTitle('🔍 نتيجة التحقيق')
    .setDescription(
      `قمت بالتحقيق مع **${target.username}**.\n\n` +
        `**النتيجة:** ${
          isKiller
            ? '⚠️ هذا اللاعب **هو القاتل**!'
            : '✅ هذا اللاعب **ليس القاتل**.'
        }`
    )
    .setColor(isKiller ? config.COLORS.DANGER : config.COLORS.SUCCESS)
    .setFooter({ text: 'احتفظ بهذه المعلومة سرية!' })
    .setTimestamp();
}

/**
 * Day-phase embed.
 * @param {import('../models/GameSession')} game
 * @returns {EmbedBuilder}
 */
function dayPhaseEmbed(game) {
  return new EmbedBuilder()
    .setTitle(`☀️ النهار ${game.currentDay} - مرحلة النقاش`)
    .setDescription(
      'أشرقت الشمس! ناقش مع اللاعبين الآخرين واكتشف القاتل.\n\n' +
        `سيبدأ التصويت خلال **${formatTime(config.TIMERS.DAY)}**.`
    )
    .setColor(config.COLORS.WARNING)
    .addFields(
      { name: '⏱️ وقت النقاش', value: `${formatTime(config.TIMERS.DAY)}`, inline: true },
      { name: '💚 أحياء', value: `${game.alivePlayers.length}`, inline: true },
      { name: '💀 موتى', value: `${game.deadPlayers.length}`, inline: true }
    )
    .setTimestamp();
}

/**
 * Voting-phase embed.
 * @param {import('../models/GameSession')} game
 * @returns {EmbedBuilder}
 */
function votingEmbed(game) {
  const warningSec = Math.round((config.TIMERS.VOTING_WARNING_BEFORE_END_MS || 10000) / 1000);
  return new EmbedBuilder()
    .setTitle('🗳️ مرحلة التصويت')
    .setDescription(
      'صوّت لطرد اللاعب الذي تشك فيه.\n' +
        `⏰ سيتم إرسال تنبيه قبل انتهاء الوقت بـ **${warningSec} ثانية**.\n` +
        'يمكنك تغيير صوتك حتى انتهاء الوقت.'
    )
    .setColor(config.COLORS.WARNING)
    .addFields(
      { name: '⏱️ وقت التصويت', value: `${formatTime(config.TIMERS.VOTING)}`, inline: true },
      { name: '💚 أحياء', value: `${game.alivePlayers.length}`, inline: true },
      { name: '✅ الأصوات', value: `${game.votes.size} / ${game.alivePlayers.length}`, inline: true }
    )
    .setTimestamp();
}

/**
 * Execution result embed.
 * @param {import('../models/GameSession')} game
 * @param {import('../models/Player')} player
 * @returns {EmbedBuilder}
 */
function executionEmbed(game, player) {
  return new EmbedBuilder()
    .setTitle('⚖️ تنفيذ الحكم')
    .setDescription(`**${player.username}** أُعدم بتصويت الأغلبية.`)
    .addFields({
      name: '🎭 الدور المكشوف',
      value: `${RoleEmoji[player.role]} **${player.role}**`,
      inline: true
    })
    .setColor(config.COLORS.DANGER)
    .addFields(
      { name: '💚 أحياء', value: `${game.alivePlayers.length}`, inline: true },
      { name: '💀 موتى', value: `${game.deadPlayers.length}`, inline: true }
    )
    .setTimestamp();
}

/**
 * Game-over embed.
 * @param {import('../models/GameSession')} game
 * @param {string} winnerTeam
 * @returns {EmbedBuilder}
 */
function gameEndedEmbed(game, winnerTeam) {
  const description =
    winnerTeam === Team.KILLERS
      ? '🔪 **فاز القتلة!**\nسيطروا على المدينة.'
      : '👥 **فاز المواطنون!**\nتم القضاء على القتلة.';

  const playerList = Array.from(game.players.values())
    .map(
      (p) =>
        `${RoleEmoji[p.role]} **${p.username}** - ${p.role}${p.alive ? ' _(حي)_' : ' _(ميت)_'}`
    )
    .join('\n');

  return new EmbedBuilder()
    .setTitle('🏆 انتهت اللعبة')
    .setDescription(`${description}\n\n**الأدوار النهائية:**\n${playerList}`)
    .setColor(config.COLORS.SUCCESS)
    .addFields(
      { name: '🏆 الفائز', value: winnerTeam, inline: true },
      { name: '📅 عدد الجولات', value: `${game.currentDay}`, inline: true }
    )
    .setTimestamp();
}

/**
 * Generic error embed.
 * @param {string} message
 * @returns {EmbedBuilder}
 */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setTitle('❌ خطأ')
    .setDescription(message)
    .setColor(config.COLORS.DANGER)
    .setTimestamp();
}

/**
 * Generic success embed.
 * @param {string} message
 * @returns {EmbedBuilder}
 */
function successEmbed(message) {
  return new EmbedBuilder()
    .setTitle('✅ تم')
    .setDescription(message)
    .setColor(config.COLORS.SUCCESS)
    .setTimestamp();
}

/**
 * Generic info embed.
 * @param {string} title
 * @param {string} message
 * @returns {EmbedBuilder}
 */
function infoEmbed(title, message) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(message)
    .setColor(config.COLORS.INFO)
    .setTimestamp();
}

module.exports = {
  stateName,
  createGameEmbed,
  lobbyEmbed,
  roleDMEmbed,
  nightStartEmbed,
  nightResultEmbed,
  investigationResultEmbed,
  dayPhaseEmbed,
  votingEmbed,
  executionEmbed,
  gameEndedEmbed,
  errorEmbed,
  successEmbed,
  infoEmbed
};
