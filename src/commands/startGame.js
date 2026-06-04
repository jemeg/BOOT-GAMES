/**
 * /start
 * بدء اللعبة: توزيع الأدوار، إرسال Dms، وتشغيل حلقة اللعبة.
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, infoEmbed } = require('../utils/embeds');
const { MIN_PLAYERS } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('ابدأ لعبة المافيا في هذه القناة.'),

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
      embeds: [infoEmbed('⏳ جاري البدء...', 'يتم توزيع الأدوار وتشغيل اللعبة!')],
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
};
