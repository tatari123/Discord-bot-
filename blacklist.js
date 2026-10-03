const { SlashCommandBuilder } = require('discord.js');
const { stmt } = require('../database/db');
const { calculateExpiration, formatExpiration, isExpired } = require('../utils/duration');
const { successEmbed, errorEmbed, infoEmbed, isValidDiscordId } = require('../utils/helpers');
const { log, Actions } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Gestion de la blacklist')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Ajouter à la blacklist')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Type de blacklist')
            .setRequired(true)
            .addChoices(
              { name: 'Discord ID', value: 'discord_id' },
              { name: 'License Key', value: 'license' },
              { name: 'HWID', value: 'hwid' }
            )
        )
        .addStringOption(opt =>
          opt.setName('value')
            .setDescription('Valeur (ID, clé ou HWID)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Durée (ex: 4d, 2h, 30d, lifetime)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Raison')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Retirer de la blacklist')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Type')
            .setRequired(true)
            .addChoices(
              { name: 'Discord ID', value: 'discord_id' },
              { name: 'License Key', value: 'license' },
              { name: 'HWID', value: 'hwid' }
            )
        )
        .addStringOption(opt =>
          opt.setName('value')
            .setDescription('Valeur')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Lister la blacklist')
    ),

  ownerOnly: true,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const type = interaction.options.getString('type');
      const value = interaction.options.getString('value').trim();
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason');

      if (type === 'discord_id' && !isValidDiscordId(value)) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', 'ID Discord invalide.')],
          ephemeral: true
        });
      }

      const exp = calculateExpiration(durationStr);
      if (!exp) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', 'Durée invalide. Ex: 30m, 2h, 4d, lifetime')],
          ephemeral: true
        });
      }

      stmt.addBlacklist.run(type, value, reason, exp.expiresAt, interaction.user.id);
      log(Actions.BLACKLIST_ADDED, interaction.user.id, value, { type, reason, duration: exp.label });

      await interaction.reply({
        embeds: [successEmbed(
          'Blacklist ajoutée',
          `**Type :** ${type}\n**Valeur :** \`${value}\`\n**Durée :** ${exp.label}\n**Raison :** ${reason}`
        )],
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const type = interaction.options.getString('type');
      const value = interaction.options.getString('value').trim();

      const existing = stmt.getBlacklist.get(type, value);
      if (!existing) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', 'Entrée introuvable dans la blacklist.')],
          ephemeral: true
        });
      }

      stmt.removeBlacklist.run(type, value);
      log(Actions.BLACKLIST_REMOVED, interaction.user.id, value, { type });

      await interaction.reply({
        embeds: [successEmbed('Blacklist retirée', `\`${value}\` (${type}) a été retiré.`)],
        ephemeral: true
      });
    }

    if (sub === 'list') {
      const list = stmt.getAllBlacklist.all();
      if (list.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Blacklist', 'Aucune entrée.')],
          ephemeral: true
        });
      }

      const lines = list.map(b => {
        const exp = b.expires_at ? formatExpiration(b.expires_at) : 'Lifetime';
        const expired = b.expires_at && isExpired(b.expires_at) ? ' (expiré)' : '';
        return `• **${b.type}** \`${b.value}\` — ${exp}${expired} — ${b.reason || '—'}`;
      });

      await interaction.reply({
        embeds: [infoEmbed('Blacklist', lines.join('\n'))],
        ephemeral: true
      });
    }
  }
};
