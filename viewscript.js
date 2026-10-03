const { EmbedBuilder } = require('discord.js');
const { getUserLicense } = require('../utils/licenseService');
const { errorEmbed, infoEmbed } = require('../utils/helpers');

module.exports = {
  type: 'button',
  customId: 'viewscript',
  async execute(interaction) {
    if (interaction.customId !== 'viewscript:open') return;

    await interaction.deferReply({ ephemeral: true });

    const info = getUserLicense(interaction.user.id);

    if (!info) {
      return interaction.editReply({
        embeds: [errorEmbed('Accès refusé', 'Tu n\'as pas de licence active. Active une licence d\'abord.')]
      });
    }

    if (!info.scripts || info.scripts.length === 0) {
      return interaction.editReply({
        embeds: [infoEmbed('Scripts', 'Aucun script associé à ta licence pour le moment.')]
      });
    }

    const lines = info.scripts.map(s => {
      const status = s.status === 'active' ? '🟢' : '🔴';
      return `${status} **${s.name}** — Licence requise : \`${info.key.slice(0, 12)}...\``;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('👁️ View Script')
      .setDescription(
        'Scripts auxquels ta licence donne accès :\n\n' + lines.join('\n')
      )
      .setFooter({ text: 'Lua Protector • Les scripts ne sont jamais envoyés sans droits' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
