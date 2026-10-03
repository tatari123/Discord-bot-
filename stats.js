const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { stmt } = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Statistiques du système Lua Protector'),

  ownerOnly: true,

  async execute(interaction) {
    const totalLicenses = stmt.countLicenses.get().count;
    const activeLicenses = stmt.countActiveLicenses.get().count;
    const totalUsers = stmt.countUsers.get().count;
    const totalBlacklist = stmt.countBlacklist.get().count;
    const totalWhitelist = stmt.countWhitelist.get().count;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 Statistiques — Lua Protector')
      .addFields(
        { name: '🔑 Licences totales', value: String(totalLicenses), inline: true },
        { name: '🟢 Licences actives', value: String(activeLicenses), inline: true },
        { name: '👤 Utilisateurs', value: String(totalUsers), inline: true },
        { name: '✅ Whitelist', value: String(totalWhitelist), inline: true },
        { name: '⛔ Blacklist', value: String(totalBlacklist), inline: true },
        { name: '🟢 Système', value: 'Online', inline: true }
      )
      .setFooter({ text: 'Lua Protector' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
