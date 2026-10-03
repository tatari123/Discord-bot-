const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Génère une clé de licence sécurisée : LUA-XXXX-XXXX-XXXX
 */
function generateLicenseKey() {
  const segment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LUA-${segment()}-${segment()}-${segment()}`;
}

/**
 * Embed de base stylisé Lua Protector
 */
function baseEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2) // Discord blurple
    .setFooter({ text: 'Lua Protector • Système privé' })
    .setTimestamp();
}

/**
 * Embed succès
 */
function successEmbed(title, description) {
  return baseEmbed()
    .setColor(0x57F287)
    .setTitle(`✅ ${title}`)
    .setDescription(description);
}

/**
 * Embed erreur
 */
function errorEmbed(title, description) {
  return baseEmbed()
    .setColor(0xED4245)
    .setTitle(`❌ ${title}`)
    .setDescription(description);
}

/**
 * Embed info
 */
function infoEmbed(title, description) {
  return baseEmbed()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description);
}

/**
 * Embed warning
 */
function warningEmbed(title, description) {
  return baseEmbed()
    .setColor(0xFEE75C)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description);
}

/**
 * Vérifie si l'utilisateur est l'owner
 */
function isOwner(userId) {
  return userId === process.env.OWNER_ID;
}

/**
 * Vérifie que l'interaction est dans la bonne guild
 */
function isCorrectGuild(interaction) {
  return interaction.guildId === process.env.DISCORD_GUILD_ID;
}

/**
 * Réponse éphémère d'erreur simple
 */
async function replyError(interaction, message) {
  const embed = errorEmbed('Erreur', message);
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Réponse éphémère de succès
 */
async function replySuccess(interaction, title, message) {
  const embed = successEmbed(title, message);
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Valide un Discord ID (snowflake)
 */
function isValidDiscordId(id) {
  return /^\d{17,20}$/.test(String(id));
}

/**
 * Tronque un texte
 */
function truncate(str, max = 100) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

module.exports = {
  generateLicenseKey,
  baseEmbed,
  successEmbed,
  errorEmbed,
  infoEmbed,
  warningEmbed,
  isOwner,
  isCorrectGuild,
  replyError,
  replySuccess,
  isValidDiscordId,
  truncate
};
