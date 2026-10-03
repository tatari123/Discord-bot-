const { SlashCommandBuilder } = require('discord.js');
const { stmt } = require('../database/db');
const { calculateExpiration, formatDate, formatExpiration, isExpired } = require('../utils/duration');
const { successEmbed, errorEmbed, infoEmbed, isValidDiscordId } = require('../utils/helpers');
const { log, Actions } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Gestion de la whitelist')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Ajouter un utilisateur à la whitelist')
        .addStringOption(opt =>
          opt.setName('discord_id')
            .setDescription('ID Discord de l\'utilisateur')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Durée (ex: 4d, 2h, lifetime)')
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
        .setDescription('Retirer un utilisateur de la whitelist')
        .addStringOption(opt =>
          opt.setName('discord_id')
            .setDescription('ID Discord')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Lister la whitelist')
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Vérifier si un utilisateur est whitelisté')
        .addStringOption(opt =>
          opt.setName('discord_id')
            .setDescription('ID Discord')
            .setRequired(true)
        )
    ),

  ownerOnly: true,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const discordId = interaction.options.getString('discord_id').trim();
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason');

      if (!isValidDiscordId(discordId)) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', 'ID Discord invalide.')],
          ephemeral: true
        });
      }

      const exp = calculateExpiration(durationStr);
      if (!exp) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', 'Durée invalide. Ex: 30m, 2h, 4d, 3w, 2mo, lifetime')],
          ephemeral: true
        });
      }

      stmt.addWhitelist.run(discordId, reason, exp.expiresAt, interaction.user.id);
      log(Actions.WHITELIST_ADDED, interaction.user.id, discordId, { reason, duration: exp.label });

      await interaction.reply({
        embeds: [successEmbed(
          'Whitelist ajoutée',
          `**Utilisateur :** <@${discordId}>\n**Durée :** ${exp.label}\n**Raison :** ${reason}`
        )],
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const discordId = interaction.options.getString('discord_id').trim();
      const existing = stmt.getWhitelist.get(discordId);

      if (!existing) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas dans la whitelist.')],
          ephemeral: true
        });
      }

      stmt.removeWhitelist.run(discordId);
      log(Actions.WHITELIST_REMOVED, interaction.user.id, discordId);

      await interaction.reply({
        embeds: [successEmbed('Whitelist retirée', `<@${discordId}> a été retiré de la whitelist.`)],
        ephemeral: true
      });
    }

    if (sub === 'list') {
      const list = stmt.getAllWhitelist.all();
      if (list.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Whitelist', 'Aucun utilisateur whitelisté.')],
          ephemeral: true
        });
      }

      const lines = list.map(w => {
        const exp = w.expires_at ? formatExpiration(w.expires_at) : 'Lifetime';
        const expired = w.expires_at && isExpired(w.expires_at) ? ' (expiré)' : '';
        return `• <@${w.discord_id}> — ${exp}${expired} — ${w.reason || '—'}`;
      });

      await interaction.reply({
        embeds: [infoEmbed('Whitelist', lines.join('\n'))],
        ephemeral: true
      });
    }

    if (sub === 'check') {
      const discordId = interaction.options.getString('discord_id').trim();
      const w = stmt.getWhitelist.get(discordId);

      if (!w || (w.expires_at && isExpired(w.expires_at))) {
        return interaction.reply({
          embeds: [infoEmbed('Check Whitelist', `<@${discordId}> n'est **pas** whitelisté.`)],
          ephemeral: true
        });
      }

      await interaction.reply({
        embeds: [successEmbed(
          'Check Whitelist',
          `<@${discordId}> est whitelisté.\n**Expire :** ${formatExpiration(w.expires_at)}\n**Raison :** ${w.reason || '—'}`
        )],
        ephemeral: true
      });
    }
  }
};
