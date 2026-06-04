/**
 * /join
 * انضمام اللاعب إلى اللعبة في القناة الحالية.
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed, lobbyEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('انضم إلى لعبة المافيا في هذه القناة.'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    const game = client.gameManager.getGameByChannel(interaction.channelId);
    if (!game) {
      return interaction.reply({
        embeds: [errorEmbed('لا توجد لعبة في هذه القناة. استخدم `/create-game` أولاً.')],
        ephemeral: true
      });
    }
    if (game.state !== 'WAITING') {
      return interaction.reply({
        embeds: [errorEmbed('اللعبة بدأت بالفعل، لا يمكن الانضمام الآن.')],
        ephemeral: true
      });
    }

    const result = game.addPlayer(interaction.user);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(result.error || 'تعذّر الانضمام.')],
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
      embeds: [successEmbed(`انضممت إلى **${game.roomName}**!`)],
      ephemeral: true
    });
  }
};
