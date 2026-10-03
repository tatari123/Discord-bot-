const {
  SlashCommandBuilder,
  AttachmentBuilder
} = require('discord.js');
const { successEmbed, errorEmbed, warningEmbed } = require('../utils/helpers');
const { log, Actions } = require('../utils/logger');
const { stmt } = require('../database/db');
const fs = require('fs');
const path = require('path');
const https = require('https');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protect')
    .setDescription('Protéger un script Lua/Luau via MoonVeil')
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('Fichier .lua ou .luau')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('script_name')
        .setDescription('Nom du script/projet (optionnel)')
    ),

  ownerOnly: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('file');
    const scriptName = interaction.options.getString('script_name') || attachment.name.replace(/\.(lua|luau)$/i, '');

    // Validations
    if (!attachment.name.match(/\.(lua|luau)$/i)) {
      return interaction.editReply({
        embeds: [errorEmbed('Fichier invalide', 'Seuls les fichiers `.lua` et `.luau` sont acceptés.')]
      });
    }

    if (attachment.size > MAX_FILE_SIZE) {
      return interaction.editReply({
        embeds: [errorEmbed('Fichier trop gros', `Taille max : 5 MB. Ton fichier fait ${(attachment.size / 1024 / 1024).toFixed(2)} MB.`)]
      });
    }

    const moonveilKey = process.env.MOONVEIL_KEY;
    if (!moonveilKey) {
      return interaction.editReply({
        embeds: [errorEmbed('Configuration manquante', 'MOONVEIL_KEY n\'est pas définie dans le .env')]
      });
    }

    try {
      // Télécharger le contenu du fichier
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(`Impossible de télécharger le fichier (${response.status})`);
      }
      const sourceCode = await response.text();

      if (!sourceCode || sourceCode.trim().length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Fichier vide', 'Le fichier fourni est vide.')]
        });
      }

      // Appel API MoonVeil
      const obfuscated = await callMoonVeil(sourceCode, moonveilKey);

      // Sauvegarder en base (optionnel)
      try {
        const existing = stmt.getScriptByName.get(scriptName);
        if (!existing) {
          stmt.createScript.run(scriptName, `Protégé le ${new Date().toLocaleDateString('fr-FR')}`, null);
        }
      } catch (_) {}

      // Créer le fichier de sortie
      const outName = `${scriptName}_protected.lua`;
      const buffer = Buffer.from(obfuscated, 'utf-8');
      const file = new AttachmentBuilder(buffer, { name: outName });

      log(Actions.SCRIPT_PROTECTED, interaction.user.id, scriptName, {
        originalSize: attachment.size,
        resultSize: buffer.length
      });

      await interaction.editReply({
        embeds: [successEmbed(
          'Script protégé',
          `**Nom :** ${scriptName}\n**Fichier original :** ${attachment.name}\n**Taille résultat :** ${(buffer.length / 1024).toFixed(1)} KB`
        )],
        files: [file]
      });
    } catch (err) {
      console.error('[PROTECT] Erreur:', err.message);
      log(Actions.API_ERROR, interaction.user.id, null, { action: 'protect', error: err.message });

      let msg = err.message;
      if (msg.includes('401') || msg.includes('403')) {
        msg = 'Clé MoonVeil invalide ou expirée.';
      } else if (msg.includes('429')) {
        msg = 'Rate limit MoonVeil atteint. Réessaie plus tard.';
      } else if (msg.includes('quota')) {
        msg = 'Quota MoonVeil dépassé.';
      }

      await interaction.editReply({
        embeds: [errorEmbed('Erreur de protection', msg)]
      });
    }
  }
};

/**
 * Appel à l'API MoonVeil
 */
function callMoonVeil(sourceCode, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      script: sourceCode
      // Tu peux ajouter d'autres options selon la doc MoonVeil
    });

    const url = new URL('https://moonveil.cc/api/v2/obf');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429) {
          return reject(new Error('429 Rate limit'));
        }
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reject(new Error(`${res.statusCode} Unauthorized`));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }

        try {
          const json = JSON.parse(data);
          // Adapter selon la réponse réelle de MoonVeil
          const result = json.result || json.obfuscated || json.script || json.data || data;
          if (!result || typeof result !== 'string') {
            return reject(new Error('Réponse MoonVeil invalide'));
          }
          resolve(result);
        } catch {
          // Si ce n'est pas du JSON, on suppose que c'est le script directement
          if (data && data.length > 10) {
            resolve(data);
          } else {
            reject(new Error('Réponse MoonVeil invalide'));
          }
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout MoonVeil (60s)'));
    });
    req.write(body);
    req.end();
  });
}
