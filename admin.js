const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { createLicense, revokeLicense } = require('../utils/licenseService');
const { stmt } = require('../database/db');
const { successEmbed, errorEmbed, infoEmbed, isValidDiscordId } = require('../utils/helpers');
const { calculateExpiration, formatExpiration, isExpired, formatDate } = require('../utils/duration');
const { log, Actions } = require('../utils/logger');

module.exports = {
  type: 'button',
  customId: 'admin',
  async execute(interaction) {
    const action = interaction.customId;

    // ========== CREATE LICENSE ==========
    if (action === 'admin:create_license') {
      const modal = new ModalBuilder()
        .setCustomId('admin:create_license_submit')
        .setTitle('🔑 Create License');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Durée (30m, 2h, 4d, 3w, 2mo, lifetime)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('4d')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('max_hwid')
            .setLabel('Max HWID (1-10)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('1')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('max_resets')
            .setLabel('Max HWID Resets (0-20)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('1')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('note')
            .setLabel('Note (optionnel)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }

    // ========== REVOKE LICENSE ==========
    if (action === 'admin:revoke_license') {
      const modal = new ModalBuilder()
        .setCustomId('admin:revoke_license_submit')
        .setTitle('🗑️ Revoke License');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('key')
            .setLabel('License Key')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('LUA-XXXX-XXXX-XXXX')
        )
      );

      return interaction.showModal(modal);
    }

    // ========== WHITELIST ==========
    if (action === 'admin:whitelist') {
      const modal = new ModalBuilder()
        .setCustomId('admin:whitelist_submit')
        .setTitle('✅ Whitelist User');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('discord_id')
            .setLabel('Discord ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Durée (4d, 2h, lifetime...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('4d')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Raison')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Test client')
        )
      );

      return interaction.showModal(modal);
    }

    // ========== BLACKLIST ==========
    if (action === 'admin:blacklist') {
      const modal = new ModalBuilder()
        .setCustomId('admin:blacklist_submit')
        .setTitle('⛔ Blacklist');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('type')
            .setLabel('Type (discord_id / license / hwid)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('discord_id')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('value')
            .setLabel('Valeur (ID, clé ou HWID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Durée (4d, 30d, lifetime...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('7d')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Raison')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    // ========== MANAGE HWID ==========
    if (action === 'admin:manage_hwid') {
      return interaction.reply({
        embeds: [infoEmbed(
          'Manage HWID',
          'Pour gérer les HWID d\'un utilisateur, utilise les commandes :\n' +
          '• `/license list` pour trouver la licence\n' +
          '• L\'utilisateur peut reset via le bouton HWID du panel\n\n' +
          'Fonction admin avancée à venir dans une prochaine version.'
        )],
        ephemeral: true
      });
    }

    // ========== PROTECT SCRIPT ==========
    if (action === 'admin:protect_script') {
      return interaction.reply({
        embeds: [infoEmbed(
          'Protect Script',
          'Utilise la commande `/protect` et attache un fichier `.lua` ou `.luau`.\n\n' +
          'Le script sera envoyé à MoonVeil et le résultat te sera renvoyé en fichier.'
        )],
        ephemeral: true
      });
    }

    // ========== STATISTICS ==========
    if (action === 'admin:statistics') {
      const totalLicenses = stmt.countLicenses.get().count;
      const activeLicenses = stmt.countActiveLicenses.get().count;
      const totalUsers = stmt.countUsers.get().count;
      const totalBlacklist = stmt.countBlacklist.get().count;
      const totalWhitelist = stmt.countWhitelist.get().count;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Statistics')
        .addFields(
          { name: '🔑 Licences totales', value: String(totalLicenses), inline: true },
          { name: '🟢 Actives', value: String(activeLicenses), inline: true },
          { name: '👤 Users', value: String(totalUsers), inline: true },
          { name: '✅ Whitelist', value: String(totalWhitelist), inline: true },
          { name: '⛔ Blacklist', value: String(totalBlacklist), inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ========== LOGS ==========
    if (action === 'admin:logs') {
      const logs = stmt.getRecentLogs.all(15);
      if (logs.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Logs', 'Aucun log pour le moment.')],
          ephemeral: true
        });
      }

      const lines = logs.map(l => {
        const date = formatDate(l.created_at);
        return `\`[${date}]\` **${l.action}** ${l.actor_id ? `par <@${l.actor_id}>` : ''} ${l.target_id ? `→ \`${l.target_id}\`` : ''}`;
      });

      return interaction.reply({
        embeds: [infoEmbed('📋 Derniers logs', lines.join('\n'))],
        ephemeral: true
      });
    }
  }
};
