const { SlashCommandBuilder } = require('discord.js');
const { createLicense, revokeLicense } = require('../utils/licenseService');
const { stmt } = require('../database/db');
const { successEmbed, errorEmbed, infoEmbed, isValidDiscordId } = require('../utils/helpers');
const { formatDate, formatExpiration } = require('../utils/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Gestion des licences')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Créer une nouvelle licence')
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Durée (ex: 30m, 2h, 4d, 3w, 2mo, 365d, lifetime)')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('max_hwid')
            .setDescription('Nombre max de HWID (défaut: 1)')
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addIntegerOption(opt =>
          opt.setName('max_resets')
            .setDescription('Nombre max de resets HWID (défaut: 1)')
            .setMinValue(0)
            .setMaxValue(20)
        )
        .addStringOption(opt =>
          opt.setName('note')
            .setDescription('Note interne (optionnel)')
        )
    )
    .addSubcommand(sub =>
      sub.setName('revoke')
        .setDescription('Révoquer une licence')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('Clé de licence (LUA-XXXX-XXXX-XXXX)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Lister les licences récentes')
        .addIntegerOption(opt =>
          opt.setName('limit')
            .setDescription('Nombre de licences (défaut: 10)')
            .setMinValue(1)
            .setMaxValue(25)
        )
    ),

  ownerOnly: true,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const duration = interaction.options.getString('duration');
      const maxHwid = interaction.options.getInteger('max_hwid') ?? 1;
      const maxResets = interaction.options.getInteger('max_resets') ?? 1;
      const note = interaction.options.getString('note');

      try {
        const license = createLicense({
          durationStr: duration,
          maxHwid,
          maxHwidResets: maxResets,
          createdBy: interaction.user.id,
          note
        });

        const embed = successEmbed(
          'Licence créée',
          `**Clé :** \`${license.key}\`\n` +
          `**Durée :** ${license.durationLabel}\n` +
          `**Max HWID :** ${license.maxHwid}\n` +
          `**Max Resets :** ${license.maxHwidResets}\n\n` +
          `⚠️ **Copie cette clé maintenant.** Elle ne sera plus affichée.`
        );

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        await interaction.reply({
          embeds: [errorEmbed('Erreur', err.message)],
          ephemeral: true
        });
      }
    }

    if (sub === 'revoke') {
      const key = interaction.options.getString('key').trim().toUpperCase();
      const result = revokeLicense(key, interaction.user.id);

      if (!result.success) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', result.error)],
          ephemeral: true
        });
      }

      await interaction.reply({
        embeds: [successEmbed('Licence révoquée', `La licence \`${key}\` a été révoquée.`)],
        ephemeral: true
      });
    }

    if (sub === 'list') {
      const limit = interaction.options.getInteger('limit') ?? 10;
      const licenses = stmt.getAllLicenses.all(limit);

      if (licenses.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Licences', 'Aucune licence trouvée.')],
          ephemeral: true
        });
      }

      const lines = licenses.map(l => {
        const statusEmoji = {
          unused: '⚪',
          active: '🟢',
          revoked: '🔴',
          expired: '⚫'
        }[l.status] || '❓';
        return `${statusEmoji} \`${l.key}\` — ${l.status} — ${l.duration_label || 'N/A'} — ${l.discord_id ? `<@${l.discord_id}>` : '—'}`;
      });

      const embed = infoEmbed('Liste des licences', lines.join('\n'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
