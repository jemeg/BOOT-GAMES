/**
 * /remove-bots
 * إزالة كل البوتات من اللوبي.
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed, lobbyEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-bots')
    .setDescription('أزل كل اللاعبين الوهميين (البوتات) من اللوبي.'),

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
        embeds: [errorEmbed('لا توجد لعبة في هذه القناة.')],
        ephemeral: true
      });
    }
    if (game.state !== 'WAITING') {
      return interaction.reply({
        embeds: [errorEmbed('اللعبة بدأت بالفعل.')],
        ephemeral: true
      });
    }

    const result = client.botManager.removeAllBots(game);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(result.error || 'تعذّر إزالة البوتات.')],
        ephemeral: true
      });
    }

    if (result.removed === 0) {
      return interaction.reply({
        embeds: [successEmbed('لا يوجد بوتات في اللوبي.')],
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
      embeds: [successEmbed(`تمت إزالة **${result.removed}** بوت من اللوبي.`)],
      ephemeral: true
    });
  }
};
