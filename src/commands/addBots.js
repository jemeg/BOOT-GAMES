/**
 * /add-bots
 * إضافة لاعبين وهميين للوبي (للعب الفردي / الاختبار).
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed, lobbyEmbed } = require('../utils/embeds');
const { MIN_PLAYERS } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-bots')
    .setDescription('أضف لاعبين وهميين (بوتات) للعب وحدك.')
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription(
          `عدد البوتات المراد إضافتها. اتركه فارغاً لملء اللوبي حتى ${MIN_PLAYERS} لاعبين.`
        )
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(9)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    if (!client.botManager || !client.botManager.isEnabled()) {
      return interaction.reply({
        embeds: [errorEmbed('نظام البوتات معطّل حالياً.')],
        ephemeral: true
      });
    }

    const game = client.gameManager.getGameByChannel(interaction.channelId);
    if (!game) {
      return interaction.reply({
        embeds: [errorEmbed('لا توجد لعبة في هذه القناة. استخدم `/create-game` أولاً.')],
        ephemeral: true
      });
    }
    if (game.state !== 'WAITING') {
      return interaction.reply({
        embeds: [errorEmbed('اللعبة بدأت بالفعل.')],
        ephemeral: true
      });
    }

    const requested = interaction.options.getInteger('count');
    const remainingSlots = game.maxPlayers - game.players.size;
    const needed = Math.max(0, MIN_PLAYERS - game.players.size);
    const count = requested ?? Math.max(needed, 0);

    if (count <= 0) {
      return interaction.reply({
        embeds: [errorEmbed(`يوجد ${MIN_PLAYERS} لاعبين أو أكثر في اللوبي بالفعل.`)],
        ephemeral: true
      });
    }
    if (count > remainingSlots) {
      return interaction.reply({
        embeds: [errorEmbed(`بقي ${remainingSlots} مقعد فقط في اللوبي.`)],
        ephemeral: true
      });
    }

    const result = client.botManager.addBotsToGame(game, count);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(result.error || 'تعذّر إضافة البوتات.')],
        ephemeral: true
      });
    }

    if (game.message) {
      try {
        await game.message.edit({ embeds: [lobbyEmbed(game)] });
      } catch (err) {
        // الرسالة الأصلية قد تكون حُذفت.
      }
    }

    return interaction.reply({
      embeds: [successEmbed(`تمت إضافة **${result.added}** بوت إلى اللوبي.`)],
      ephemeral: true
    });
  }
};
