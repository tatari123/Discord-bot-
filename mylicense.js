const { EmbedBuilder } = require('discord.js');
const { getUserLicense } = require('../utils/licenseService');
const { errorEmbed } = require('../utils/helpers');

module.exports = {
  type: 'button',
  customId: 'mylicense',
  async execute(interaction) {
    if (interaction.customId !== 'mylicense:open') return;

    await interaction.deferReply({ ephemeral: true });

    const info = getUserLicense(interaction.user.id);

    if (!info) {
      return interaction.editReply({
        embeds: [errorEmbed('Aucune licence', 'Tu n\'as pas de licence active. Utilise **Redeem Key** pour en activer une.')]
      });
    }

    const hwidText = info.hwids.length > 0
      ? info.hwids.map(h => `\`${h.hwid}\` (vu: ${h.lastSeen})`).join('\n')
      : 'Aucun HWID enregistré';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 My License')
      .addFields(
        { name: '🔑 License', value: `\`${info.key}\``, inline: false },
        { name: '🟢 Status', value: info.status === 'active' ? '🟢 Active' : info.status, inline: true },
        { name: '📅 Created', value: info.createdAt, inline: true },
        { name: '⏱️ Expires', value: info.isLifetime ? 'Lifetime' : info.expiresLabel, inline: true },
        { name: '💻 HWID', value: hwidText, inline: false },
        { name: '🔄 HWID Resets', value: `${info.hwidResets} / ${info.maxHwidResets}`, inline: true }
      )
      .setFooter({ text: 'Lua Protector' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
