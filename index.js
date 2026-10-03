require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { initDatabase } = require('./database/db');
const { createApiServer } = require('./api/server');

// Vérification des variables d'environnement critiques
const requiredEnv = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'OWNER_ID'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[ERREUR] Variable d'environnement manquante: ${key}`);
    console.error('Copie .env.example en .env et remplis les valeurs.');
    process.exit(1);
  }
}

// Initialiser la base de données
initDatabase();

// Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

// Collections
client.commands = new Collection();
client.buttonHandlers = new Collection();
client.modalHandlers = new Collection();
client.selectHandlers = new Collection();

// Charger les commandes
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`[CMD] Chargée: /${command.data.name}`);
    }
  }
}

// Charger les handlers (boutons, modals, selects)
const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
  const handlerFiles = fs.readdirSync(handlersPath).filter(f => f.endsWith('.js'));
  for (const file of handlerFiles) {
    const handler = require(path.join(handlersPath, file));
    if (handler.type === 'button' && handler.customId && handler.execute) {
      client.buttonHandlers.set(handler.customId, handler.execute);
      console.log(`[BTN] Handler: ${handler.customId}`);
    }
    if (handler.type === 'modal' && handler.customId && handler.execute) {
      client.modalHandlers.set(handler.customId, handler.execute);
      console.log(`[MODAL] Handler: ${handler.customId}`);
    }
    if (handler.type === 'select' && handler.customId && handler.execute) {
      client.selectHandlers.set(handler.customId, handler.execute);
      console.log(`[SELECT] Handler: ${handler.customId}`);
    }
  }
}

// Charger les events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

// API Backend
const apiApp = createApiServer();
const API_PORT = process.env.API_PORT || 3000;

apiApp.listen(API_PORT, () => {
  console.log(`[API] Serveur démarré sur le port ${API_PORT}`);
});

// Keep-alive HTTP simple (pour hébergeurs type Replit / Railway / etc.)
const KEEP_ALIVE_PORT = process.env.KEEP_ALIVE_PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Lua Protector is online ✅');
}).listen(KEEP_ALIVE_PORT, () => {
  console.log(`[KEEP-ALIVE] Serveur actif sur le port ${KEEP_ALIVE_PORT}`);
});

// Connexion Discord
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('[BOT] Impossible de se connecter:', err.message);
  process.exit(1);
});

// Gestion des erreurs non catchées
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err);
});
