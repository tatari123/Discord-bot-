const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  type: 'button',
  customId: 'redeem',
  async execute(interaction) {
    if (interaction.customId !== 'redeem:open') return;

    const modal = new ModalBuilder()
      .setCustomId('redeem:submit')
      .setTitle('🔑 Redeem License Key');

    const keyInput = new TextInputBuilder()
      .setCustomId('license_key')
      .setLabel('License Key')
      .setPlaceholder('LUA-XXXX-XXXX-XXXX')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(30);

    modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
    await interaction.showModal(modal);
  }
};
