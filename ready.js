const { ActivityType } = require('discord.js');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`[BOT] Connecté en tant que ${client.user.tag}`);
    console.log(`[BOT] Guilds: ${client.guilds.cache.size}`);

    client.user.setPresence({
      activities: [{ name: 'Lua Protector | /setup', type: ActivityType.Watching }],
      status: 'online'
    });
  }
};
