# 🛡️ Lua Protector

Bot Discord privé de gestion de licences et scripts Lua.

---

## Installation (débutant)

### 1. Installer Node.js

Va sur https://nodejs.org et installe la version **20 LTS** (ou plus récente).

Vérifie dans un terminal :
```bash
node -v
```
Tu dois voir `v20.x.x` ou plus.

### 2. Télécharger le projet

Place le dossier `lua-protector` où tu veux.

Ouvre un terminal **dans ce dossier**.

### 3. Installer les dépendances

```bash
npm install
```

### 4. Créer le bot Discord

1. Va sur https://discord.com/developers/applications
2. Clique sur **New Application** → donne un nom (ex: Lua Protector)
3. Dans **Bot** → **Add Bot** → copie le **Token**
4. Active les intents : **Server Members Intent** (optionnel) et laisse les autres
5. Dans **OAuth2 → URL Generator** :
   - Scopes : `bot` + `applications.commands`
   - Permissions : `Send Messages`, `Embed Links`, `Attach Files`, `Use Slash Commands`
6. Invite le bot sur **ton serveur uniquement** (ID : `1523674360370696272`)

### 5. Configurer le fichier .env

```bash
cp .env.example .env
```

Ouvre `.env` et remplis :

```
DISCORD_TOKEN=ton_token_ici
DISCORD_CLIENT_ID=l_id_de_ton_application
DISCORD_GUILD_ID=1523674360370696272
OWNER_ID=1049222165121204254
MOONVEIL_KEY=ta_cle_moonveil (optionnel pour commencer)
```

**Ne partage JAMAIS ton .env.**

### 6. Enregistrer les commandes slash

```bash
npm run register
```

### 7. Lancer le bot

```bash
npm start
```

Tu dois voir :
```
[DB] Base de données initialisée
[API] Serveur démarré sur le port 3000
[KEEP-ALIVE] Serveur actif sur le port 8080
[BOT] Connecté en tant que ...
```

### 8. Utiliser le bot

Dans ton serveur Discord :
- `/setup` → envoie le panel utilisateur
- `/admin` → panel admin (toi uniquement)

---

## Commandes disponibles

| Commande | Description | Qui |
|----------|-------------|-----|
| `/setup` | Panel utilisateur | Tout le monde |
| `/admin` | Panel admin | Owner |
| `/license create` | Créer une licence | Owner |
| `/license revoke` | Révoquer une licence | Owner |
| `/license list` | Lister les licences | Owner |
| `/whitelist add/remove/list/check` | Whitelist | Owner |
| `/blacklist add/remove/list` | Blacklist | Owner |
| `/protect` | Protéger un script .lua | Owner |
| `/hwid reset` | Reset son HWID | Utilisateur |
| `/stats` | Statistiques | Owner |

---

## API de licence (pour ton loader Lua)

Base URL : `http://localhost:3000` (ou ton serveur)

### Activer
```
POST /api/license/activate
{ "key": "LUA-XXXX-XXXX-XXXX", "discordId": "123", "hwid": "abc" }
```

### Vérifier
```
POST /api/license/check
{ "key": "LUA-XXXX-XXXX-XXXX", "hwid": "abc" }
```

### Reset HWID
```
POST /api/license/reset-hwid
{ "key": "LUA-XXXX-XXXX-XXXX", "discordId": "123" }
```

---

## Formats de durée

| Input | Signification |
|-------|---------------|
| `30m` | 30 minutes |
| `2h` | 2 heures |
| `4d` | 4 jours |
| `3w` | 3 semaines |
| `2mo` | 2 mois |
| `365d` | 365 jours |
| `lifetime` | Permanent |

---

## Keep-alive

Le bot démarre un petit serveur HTTP sur le port **8080**.  
Si tu héberges sur Replit / Railway / Render, utilise ce port pour le keep-alive.

---

## Support

Bot privé — Owner ID : `1049222165121204254`
