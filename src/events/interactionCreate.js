/**
 * interactionCreate event
 * The single entry point for every interaction the bot receives.
 * Routes slash commands, buttons, and select menus to the right handler.
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { errorEmbed, successEmbed, lobbyEmbed } = require('../utils/embeds');
const { MIN_PLAYERS } = require('../utils/constants');

module.exports = {
  name: 'interactionCreate',
  once: false,

  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    try {
      // ── Slash commands ───────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          return interaction.reply({
            embeds: [errorEmbed('أمر غير معروف.')],
            ephemeral: true
          });
        }
        return command.execute(interaction, client);
      }

      // ── Buttons ─────────────────────────────────────────────────────────
      if (interaction.isButton()) {
        return handleButton(interaction, client);
      }

      // ── Select menus ────────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        return handleSelectMenu(interaction, client);
      }
    } catch (err) {
      console.error('interactionCreate error:', err);
      const reply = {
        embeds: [errorEmbed('حدث خطأ غير متوقع أثناء معالجة هذا التفاعل.')],
        ephemeral: true
      };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (e) {
        // قد يكون التفاعل قد انتهت صلاحيته.
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Button handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleButton(interaction, client) {
  const [action, gameId] = interaction.customId.split('_');
  if (!action || !gameId) {
    return interaction.reply({ embeds: [errorEmbed('زر غير صالح.')], ephemeral: true });
  }

  switch (action) {
    case 'join':
      return handleJoinButton(interaction, client, gameId);
    case 'leave':
      return handleLeaveButton(interaction, client, gameId);
    case 'startbtn':
      return handleStartButton(interaction, client, gameId);
    case 'playagain':
      return handlePlayAgainButton(interaction, client, gameId);
    default:
      return interaction.reply({ embeds: [errorEmbed('إجراء غير معروف.')], ephemeral: true });
  }
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {string} gameId
 */
async function handleJoinButton(interaction, client, gameId) {
  const game = client.gameManager.getGame(gameId);
  if (!game) {
    return interaction.reply({ embeds: [errorEmbed('لم يتم العثور على اللعبة.')], ephemeral: true });
  }
  if (game.state !== 'WAITING') {
    return interaction.reply({
      embeds: [errorEmbed('اللعبة بدأت بالفعل.')],
      ephemeral: true
    });
  }

  const result = game.addPlayer(interaction.user);
  if (!result.success) {
    return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  }

  await refreshLobbyMessage(game);
  return interaction.reply({
    embeds: [successEmbed(`انضممت إلى **${game.roomName}**!`)],
    ephemeral: true
  });
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {string} gameId
 */
async function handleLeaveButton(interaction, client, gameId) {
  const game = client.gameManager.getGame(gameId);
  if (!game) {
    return interaction.reply({ embeds: [errorEmbed('لم يتم العثور على اللعبة.')], ephemeral: true });
  }
  if (game.state !== 'WAITING') {
    return interaction.reply({
      embeds: [errorEmbed('اللعبة بدأت بالفعل.')],
      ephemeral: true
    });
  }

  const result = game.removePlayer(interaction.user.id);
  if (!result.success) {
    return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
  }

  await refreshLobbyMessage(game);
  return interaction.reply({
    embeds: [successEmbed(`غادرت **${game.roomName}**.`)],
    ephemeral: true
  });
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {string} gameId
 */
async function handleStartButton(interaction, client, gameId) {
  const game = client.gameManager.getGame(gameId);
  if (!game) {
    return interaction.reply({ embeds: [errorEmbed('لم يتم العثور على اللعبة.')], ephemeral: true });
  }
  if (game.state !== 'WAITING') {
    return interaction.reply({
      embeds: [errorEmbed('اللعبة بدأت بالفعل.')],
      ephemeral: true
    });
  }
  if (game.players.size < MIN_PLAYERS) {
    return interaction.reply({
      embeds: [errorEmbed(`تحتاج إلى ${MIN_PLAYERS} لاعبين على الأقل لبدء اللعبة.`)],
      ephemeral: true
    });
  }

  await interaction.reply({
    embeds: [
      {
        title: '⏳ جاري البدء...',
        description: 'يتم توزيع الأدوار وتشغيل اللعبة!',
        color: 0x5865f2,
        timestamp: new Date().toISOString()
      }
    ],
    ephemeral: false
  });

  const result = await client.gameManager.startGame(game.gameId, client);
  if (!result.success) {
    return interaction.followUp({
      embeds: [errorEmbed(result.error || 'فشل بدء اللعبة.')],
      ephemeral: true
    });
  }

  client.gameManager
    .runGameLoop(result.game, client)
    .catch((err) => console.error('runGameLoop error:', err));
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {string} gameId
 */
async function handlePlayAgainButton(interaction, client, gameId) {
  const result = await client.gameManager.playAgain(gameId, client);
  if (!result.success) {
    return interaction.reply({
      embeds: [errorEmbed(result.error || 'تعذّر بدء لعبة جديدة.')],
      ephemeral: true
    });
  }

  return interaction.reply({
    embeds: [successEmbed(`تم إنشاء لعبة جديدة **${result.game.roomName}**!`)],
    ephemeral: false
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Select menu handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleSelectMenu(interaction, client) {
  // Expected formats:
  //   night_killer_<gameId>
  //   night_doctor_<gameId>
  //   night_detective_<gameId>
  //   vote_<gameId>
  const parts = interaction.customId.split('_');
  const [type, roleOrGameId, maybeGameId] = parts;
  if (!type) {
    return interaction.reply({ embeds: [errorEmbed('قائمة اختيار غير صالحة.')], ephemeral: true });
  }

  // night_killer_<gameId>   → 3 parts
  // vote_<gameId>           → 2 parts
  if (type === 'night') {
    const actionType = roleOrGameId; // killer | doctor | detective
    const gameId = maybeGameId;
    if (!actionType || !gameId) {
      return interaction.reply({ embeds: [errorEmbed('قائمة ليلية غير صالحة.')], ephemeral: true });
    }
    return handleNightAction(interaction, client, actionType, gameId);
  }

  if (type === 'vote') {
    const gameId = roleOrGameId;
    if (!gameId) {
      return interaction.reply({ embeds: [errorEmbed('قائمة تصويت غير صالحة.')], ephemeral: true });
    }
    return handleVote(interaction, client, gameId);
  }

  return interaction.reply({ embeds: [errorEmbed('قائمة اختيار غير معروفة.')], ephemeral: true });
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {'killer' | 'doctor' | 'detective'} actionType
 * @param {string} gameId
 */
async function handleNightAction(interaction, client, actionType, gameId) {
  const game = client.gameManager.getGame(gameId);
  if (!game) {
    return interaction.reply({ embeds: [errorEmbed('لم يتم العثور على اللعبة.')], ephemeral: true });
  }

  const targetId = interaction.values[0];
  const result = client.nightManager.handleNightAction(game, actionType, interaction.user.id, targetId);
  if (!result.success) {
    return interaction.reply({ embeds: [errorEmbed(result.error || 'تعذّر تنفيذ الإجراء.')], ephemeral: true });
  }
  return interaction.reply({ embeds: [successEmbed(result.message || 'تم تسجيل الإجراء.')], ephemeral: true });
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {string} gameId
 */
async function handleVote(interaction, client, gameId) {
  const game = client.gameManager.getGame(gameId);
  if (!game) {
    return interaction.reply({ embeds: [errorEmbed('لم يتم العثور على اللعبة.')], ephemeral: true });
  }

  const targetId = interaction.values[0];
  const result = client.voteManager.handleVote(game, interaction.user.id, targetId);
  if (!result.success) {
    return interaction.reply({ embeds: [errorEmbed(result.error || 'تعذّر تسجيل صوتك.')], ephemeral: true });
  }
  return interaction.reply({ embeds: [successEmbed(result.message || 'تم تسجيل صوتك.')], ephemeral: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refreshes the lobby message (if it still exists) with the latest embed
 * and the same three action buttons.
 * @param {import('../models/GameSession')} game
 */
async function refreshLobbyMessage(game) {
  if (!game.message) return;
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`join_${game.gameId}`)
        .setLabel('انضمام')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId(`leave_${game.gameId}`)
        .setLabel('مغادرة')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖'),
      new ButtonBuilder()
        .setCustomId(`startbtn_${game.gameId}`)
        .setLabel('بدء')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('▶️')
    );
    await game.message.edit({ embeds: [lobbyEmbed(game)], components: [row] });
  } catch (err) {
    // قد تكون الرسالة الأصلية قد حُذفت.
  }
}
