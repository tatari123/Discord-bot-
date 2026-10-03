const { EmbedBuilder } = require('discord.js');
const { activateLicense } = require('../utils/licenseService');
const { errorEmbed } = require('../utils/helpers');

module.exports = {
  type: 'modal',
  customId: 'redeem',
  async execute(interaction) {
    if (interaction.customId !== 'redeem:submit') return;

    await interaction.deferReply({ ephemeral: true });

    const key = interaction.fields.getTextInputValue('license_key').trim().toUpperCase();
    const result = activateLicense(key, interaction.user.id, null, interaction.user.username);

    if (!result.success) {
      return interaction.editReply({
        embeds: [errorEmbed('Activation échouée', result.error)]
      });
    }

    const lic = result.license;
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ License Activated')
      .addFields(
        { name: 'License', value: `\`${lic.key}\``, inline: false },
        { name: 'Status', value: '🟢 Active', inline: true },
        { name: 'Expires', value: lic.expiresLabel, inline: true }
      )
      .setFooter({ text: 'Lua Protector' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
