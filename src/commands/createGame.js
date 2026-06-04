/**
 * /create-game
 * إنشاء لعبة مافيا جديدة في القناة الحالية.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { createGameEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-game')
    .setDescription('أنشئ لعبة مافيا جديدة في هذه القناة.')
    .addStringOption((option) =>
      option
        .setName('room_name')
        .setDescription('اسم الغرفة (حتى 50 حرفاً).')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addIntegerOption((option) =>
      option
        .setName('max_players')
        .setDescription('الحد الأقصى لعدد اللاعبين (4-10).')
        .setRequired(true)
        .setMinValue(4)
        .setMaxValue(10)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    const roomName = interaction.options.getString('room_name', true);
    const maxPlayers = interaction.options.getInteger('max_players', true);

    if (!interaction.guildId || !interaction.channelId) {
      return interaction.reply({
        embeds: [errorEmbed('لا يمكن استخدام هذا الأمر إلا داخل قناة في سيرفر.')],
        ephemeral: true
      });
    }

    const result = client.gameManager.createGame({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      roomName,
      maxPlayers,
      creatorId: interaction.user.id
    });

    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(result.error || 'تعذّر إنشاء اللعبة.')],
        ephemeral: true
      });
    }

    const game = result.game;

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

    const message = await interaction.reply({
      embeds: [createGameEmbed(game)],
      components: [row],
      fetchReply: true
    });

    game.message = message;
  }
};
