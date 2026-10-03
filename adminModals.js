const { createLicense, revokeLicense } = require('../utils/licenseService');
const { stmt } = require('../database/db');
const { successEmbed, errorEmbed, isValidDiscordId } = require('../utils/helpers');
const { calculateExpiration } = require('../utils/duration');
const { log, Actions } = require('../utils/logger');

module.exports = {
  type: 'modal',
  customId: 'admin',
  async execute(interaction) {
    const id = interaction.customId;

    // Create License
    if (id === 'admin:create_license_submit') {
      await interaction.deferReply({ ephemeral: true });

      const duration = interaction.fields.getTextInputValue('duration').trim();
      const maxHwid = parseInt(interaction.fields.getTextInputValue('max_hwid'), 10) || 1;
      const maxResets = parseInt(interaction.fields.getTextInputValue('max_resets'), 10) || 1;
      const note = interaction.fields.getTextInputValue('note') || null;

      try {
        const license = createLicense({
          durationStr: duration,
          maxHwid: Math.min(Math.max(maxHwid, 1), 10),
          maxHwidResets: Math.min(Math.max(maxResets, 0), 20),
          createdBy: interaction.user.id,
          note
        });

        await interaction.editReply({
          embeds: [successEmbed(
            'Licence créée',
            `**Clé :** \`${license.key}\`\n` +
            `**Durée :** ${license.durationLabel}\n` +
            `**Max HWID :** ${license.maxHwid}\n` +
            `**Max Resets :** ${license.maxHwidResets}\n\n` +
            `⚠️ **Copie cette clé maintenant.**`
          )]
        });
      } catch (err) {
        await interaction.editReply({
          embeds: [errorEmbed('Erreur', err.message)]
        });
      }
      return;
    }

    // Revoke License
    if (id === 'admin:revoke_license_submit') {
      await interaction.deferReply({ ephemeral: true });
      const key = interaction.fields.getTextInputValue('key').trim().toUpperCase();
      const result = revokeLicense(key, interaction.user.id);

      if (!result.success) {
        return interaction.editReply({ embeds: [errorEmbed('Erreur', result.error)] });
      }

      await interaction.editReply({
        embeds: [successEmbed('Licence révoquée', `La licence \`${key}\` a été révoquée.`)]
      });
      return;
    }

    // Whitelist
    if (id === 'admin:whitelist_submit') {
      await interaction.deferReply({ ephemeral: true });

      const discordId = interaction.fields.getTextInputValue('discord_id').trim();
      const durationStr = interaction.fields.getTextInputValue('duration').trim();
      const reason = interaction.fields.getTextInputValue('reason').trim();

      if (!isValidDiscordId(discordId)) {
        return interaction.editReply({ embeds: [errorEmbed('Erreur', 'ID Discord invalide.')] });
      }

      const exp = calculateExpiration(durationStr);
      if (!exp) {
        return interaction.editReply({ embeds: [errorEmbed('Erreur', 'Durée invalide.')] });
      }

      stmt.addWhitelist.run(discordId, reason, exp.expiresAt, interaction.user.id);
      log(Actions.WHITELIST_ADDED, interaction.user.id, discordId, { reason, duration: exp.label });

      await interaction.editReply({
        embeds: [successEmbed(
          'Whitelist ajoutée',
          `**User :** <@${discordId}>\n**Durée :** ${exp.label}\n**Raison :** ${reason}`
        )]
      });
      return;
    }

    // Blacklist
    if (id === 'admin:blacklist_submit') {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
      const value = interaction.fields.getTextInputValue('value').trim();
      const durationStr = interaction.fields.getTextInputValue('duration').trim();
      const reason = interaction.fields.getTextInputValue('reason').trim();

      if (!['discord_id', 'license', 'hwid'].includes(type)) {
        return interaction.editReply({
          embeds: [errorEmbed('Erreur', 'Type invalide. Utilise : discord_id, license ou hwid')]
        });
      }

      if (type === 'discord_id' && !isValidDiscordId(value)) {
        return interaction.editReply({ embeds: [errorEmbed('Erreur', 'ID Discord invalide.')] });
      }

      const exp = calculateExpiration(durationStr);
      if (!exp) {
        return interaction.editReply({ embeds: [errorEmbed('Erreur', 'Durée invalide.')] });
      }

      stmt.addBlacklist.run(type, value, reason, exp.expiresAt, interaction.user.id);
      log(Actions.BLACKLIST_ADDED, interaction.user.id, value, { type, reason, duration: exp.label });

      await interaction.editReply({
        embeds: [successEmbed(
          'Blacklist ajoutée',
          `**Type :** ${type}\n**Valeur :** \`${value}\`\n**Durée :** ${exp.label}\n**Raison :** ${reason}`
        )]
      });
      return;
    }
  }
};
