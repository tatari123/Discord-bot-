const { stmt } = require('../database/db');
const { EmbedBuilder } = require('discord.js');

/**
 * Ajoute un log en base + optionnellement envoie dans le salon Discord
 */
function log(action, actorId = null, targetId = null, details = null) {
  try {
    stmt.addLog.run(action, actorId, targetId, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.error('[LOG] Erreur écriture log:', err.message);
  }
}

/**
 * Envoie un log dans le salon Discord configuré
 */
async function sendDiscordLog(client, action, description, color = 0x5865F2) {
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId || !client) return;

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📋 ${action}`)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: 'Lua Protector Logs' });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[LOG] Erreur envoi Discord log:', err.message);
  }
}

// Actions prédéfinies
const Actions = {
  LICENSE_CREATED: 'license_created',
  LICENSE_ACTIVATED: 'license_activated',
  LICENSE_REVOKED: 'license_revoked',
  WHITELIST_ADDED: 'whitelist_added',
  WHITELIST_REMOVED: 'whitelist_removed',
  BLACKLIST_ADDED: 'blacklist_added',
  BLACKLIST_REMOVED: 'blacklist_removed',
  HWID_REGISTERED: 'hwid_registered',
  HWID_RESET: 'hwid_reset',
  SCRIPT_PROTECTED: 'script_protected',
  API_ERROR: 'api_error',
  LOGIN_ATTEMPT: 'login_attempt'
};

module.exports = { log, sendDiscordLog, Actions };
