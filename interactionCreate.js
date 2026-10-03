const { isCorrectGuild, isOwner, replyError } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Le bot ne fonctionne QUE dans la guild configurée
    if (!isCorrectGuild(interaction)) {
      if (interaction.isRepliable()) {
        return replyError(interaction, 'Ce bot est privé et ne fonctionne que sur le serveur autorisé.');
      }
      return;
    }

    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Vérification owner pour commandes admin
        if (command.ownerOnly && !isOwner(interaction.user.id)) {
          return replyError(interaction, 'Cette commande est réservée au propriétaire.');
        }

        await command.execute(interaction, client);
        return;
      }

      // Boutons
      if (interaction.isButton()) {
        const handler = client.buttonHandlers.get(interaction.customId.split(':')[0]);
        if (handler) {
          await handler(interaction, client);
        }
        return;
      }

      // Modals
      if (interaction.isModalSubmit()) {
        const handler = client.modalHandlers.get(interaction.customId.split(':')[0]);
        if (handler) {
          await handler(interaction, client);
        }
        return;
      }

      // Select menus
      if (interaction.isStringSelectMenu()) {
        const handler = client.selectHandlers.get(interaction.customId.split(':')[0]);
        if (handler) {
          await handler(interaction, client);
        }
        return;
      }
    } catch (err) {
      console.error('[INTERACTION] Erreur:', err);
      try {
        const msg = { content: '❌ Une erreur est survenue. Réessaie plus tard.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      } catch (_) {}
    }
  }
};
