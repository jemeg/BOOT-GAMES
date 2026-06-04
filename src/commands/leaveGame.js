/**
 * /leave
 * مغادرة اللاعب من اللوبي (فقط قبل بدء اللعبة).
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed, lobbyEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('غادر لعبة المافيا في هذه القناة.'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    const game = client.gameManager.getGameByChannel(interaction.channelId);
    if (!game) {
      return interaction.reply({
        embeds: [errorEmbed('لا توجد لعبة في هذه القناة.')],
        ephemeral: true
      });
    }

    const result = game.removePlayer(interaction.user.id);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(result.error || 'تعذّرت المغادرة.')],
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
      embeds: [successEmbed(`غادرت **${game.roomName}**.`)],
      ephemeral: true
    });
  }
};
