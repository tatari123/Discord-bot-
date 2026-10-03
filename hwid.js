const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { getUserLicense, resetHwid } = require('../utils/licenseService');
const { stmt } = require('../database/db');
const { errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  type: 'button',
  customId: 'hwid',
  async execute(interaction) {
    // Affichage HWID
    if (interaction.customId === 'hwid:open') {
      await interaction.deferReply({ ephemeral: true });

      const info = getUserLicense(interaction.user.id);
      if (!info) {
        return interaction.editReply({
          embeds: [errorEmbed('Aucune licence', 'Tu n\'as pas de licence active.')]
        });
      }

      const currentHwid = info.hwids.length > 0
        ? info.hwids.map(h => `\`${h.hwid}\``).join(', ')
        : 'Aucun';

      const resetsLeft = info.maxHwidResets - info.hwidResets;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💻 HWID Manager')
        .addFields(
          { name: 'HWID actuel', value: currentHwid, inline: false },
          { name: 'Status', value: '🟢 Actif', inline: true },
          { name: 'Resets disponibles', value: `${resetsLeft} / ${info.maxHwidResets}`, inline: true },
          { name: 'Dernière activation', value: info.activatedAt || 'N/A', inline: true }
        )
        .setFooter({ text: 'Lua Protector' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hwid:reset')
          .setLabel('Reset HWID')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(resetsLeft <= 0)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    // Reset HWID
    if (interaction.customId === 'hwid:reset') {
      await interaction.deferReply({ ephemeral: true });

      const info = getUserLicense(interaction.user.id);
      if (!info) {
        return interaction.editReply({
          embeds: [errorEmbed('Erreur', 'Aucune licence active.')]
        });
      }

      const license = stmt.getLicenseByKey.get(info.key);
      const result = resetHwid(license.id, interaction.user.id);

      if (!result.success) {
        return interaction.editReply({
          embeds: [errorEmbed('Erreur', result.error)]
        });
      }

      return interaction.editReply({
        embeds: [successEmbed(
          'HWID réinitialisé',
          `Ton HWID a été reset.\n**Resets restants :** ${result.resetsLeft}`
        )]
      });
    }
  }
};
