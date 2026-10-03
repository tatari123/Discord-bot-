const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { isOwner } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Envoie le panel utilisateur Lua Protector'),

  ownerOnly: false, // accessible à tous, mais on peut restreindre si besoin

  async execute(interaction) {
    // Optionnel : seul l'owner peut poster le panel
    // if (!isOwner(interaction.user.id)) {
    //   return interaction.reply({ content: '❌ Seul le propriétaire peut utiliser /setup.', ephemeral: true });
    // }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🛡️ LUA PROTECTOR')
      .setDescription(
        '**Système privé de gestion des licences et scripts.**\n\n' +
        'Utilise les boutons ci-dessous pour gérer ta licence, voir tes scripts ou réinitialiser ton HWID.\n\n' +
        '🟢 **System Online**'
      )
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: 'Lua Protector • Service privé' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('redeem:open')
        .setLabel('Redeem Key')
        .setEmoji('🔑')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('viewscript:open')
        .setLabel('View Script')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hwid:open')
        .setLabel('HWID')
        .setEmoji('💻')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('mylicense:open')
        .setLabel('My License')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
