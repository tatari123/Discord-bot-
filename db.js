const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/lua-protector.db');

// Créer le dossier data s'il n'existe pas
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Activer les foreign keys et WAL pour performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialise toutes les tables
 */
function initDatabase() {
  db.exec(`
    -- Utilisateurs Discord
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      username TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- Licences
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      discord_id TEXT,
      status TEXT NOT NULL DEFAULT 'unused', -- unused, active, revoked, expired
      duration_raw TEXT,
      duration_label TEXT,
      expires_at INTEGER, -- NULL = lifetime
      max_hwid INTEGER NOT NULL DEFAULT 1,
      hwid_resets INTEGER NOT NULL DEFAULT 0,
      max_hwid_resets INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      activated_at INTEGER,
      revoked_at INTEGER,
      note TEXT,
      FOREIGN KEY (discord_id) REFERENCES users(discord_id)
    );

    -- HWIDs liés aux licences
    CREATE TABLE IF NOT EXISTS hwids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      hwid TEXT NOT NULL,
      first_seen INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      last_seen INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
      UNIQUE(license_id, hwid)
    );

    -- Scripts / projets
    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      file_path TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- active, disabled
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- Association licence <-> scripts
    CREATE TABLE IF NOT EXISTS license_scripts (
      license_id INTEGER NOT NULL,
      script_id INTEGER NOT NULL,
      PRIMARY KEY (license_id, script_id),
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    );

    -- Whitelist
    CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      reason TEXT,
      expires_at INTEGER, -- NULL = lifetime
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(discord_id)
    );

    -- Blacklist (Discord ID, License Key ou HWID)
    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- discord_id, license, hwid
      value TEXT NOT NULL,
      reason TEXT,
      expires_at INTEGER, -- NULL = lifetime
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(type, value)
    );

    -- Logs
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_id TEXT,
      target_id TEXT,
      details TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- Index pour performance
    CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
    CREATE INDEX IF NOT EXISTS idx_licenses_discord_id ON licenses(discord_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_hwids_license_id ON hwids(license_id);
    CREATE INDEX IF NOT EXISTS idx_hwids_hwid ON hwids(hwid);
    CREATE INDEX IF NOT EXISTS idx_blacklist_type_value ON blacklist(type, value);
    CREATE INDEX IF NOT EXISTS idx_whitelist_discord_id ON whitelist(discord_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action);
  `);

  // Settings par défaut
  const setDefault = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  setDefault.run('max_file_size_mb', '5');
  setDefault.run('default_max_hwid', '1');
  setDefault.run('default_max_hwid_resets', '1');
  setDefault.run('system_status', 'online');

  console.log('[DB] Base de données initialisée avec succès');
}

/**
 * Helpers de requête
 */
const stmt = {
  // Users
  upsertUser: db.prepare(`
    INSERT INTO users (discord_id, username, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, updated_at = excluded.updated_at
  `),

  // Licenses
  createLicense: db.prepare(`
    INSERT INTO licenses (key, duration_raw, duration_label, expires_at, max_hwid, max_hwid_resets, created_by, note, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unused')
  `),
  getLicenseByKey: db.prepare(`SELECT * FROM licenses WHERE key = ?`),
  getLicenseById: db.prepare(`SELECT * FROM licenses WHERE id = ?`),
  getLicensesByDiscordId: db.prepare(`SELECT * FROM licenses WHERE discord_id = ?`),
  getAllLicenses: db.prepare(`SELECT * FROM licenses ORDER BY created_at DESC LIMIT ?`),
  activateLicense: db.prepare(`
    UPDATE licenses SET discord_id = ?, status = 'active', activated_at = ?, expires_at = ?
    WHERE id = ?
  `),
  revokeLicense: db.prepare(`
    UPDATE licenses SET status = 'revoked', revoked_at = ? WHERE id = ?
  `),
  updateLicenseHwidResets: db.prepare(`
    UPDATE licenses SET hwid_resets = hwid_resets + 1 WHERE id = ?
  `),

  // HWIDs
  addHwid: db.prepare(`
    INSERT INTO hwids (license_id, hwid, first_seen, last_seen)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(license_id, hwid) DO UPDATE SET last_seen = excluded.last_seen, is_active = 1
  `),
  getHwidsByLicense: db.prepare(`SELECT * FROM hwids WHERE license_id = ? AND is_active = 1`),
  countActiveHwids: db.prepare(`SELECT COUNT(*) as count FROM hwids WHERE license_id = ? AND is_active = 1`),
  deactivateAllHwids: db.prepare(`UPDATE hwids SET is_active = 0 WHERE license_id = ?`),
  getHwidByValue: db.prepare(`SELECT * FROM hwids WHERE hwid = ? AND is_active = 1`),

  // Scripts
  createScript: db.prepare(`
    INSERT INTO scripts (name, description, file_path) VALUES (?, ?, ?)
  `),
  getScriptByName: db.prepare(`SELECT * FROM scripts WHERE name = ?`),
  getAllScripts: db.prepare(`SELECT * FROM scripts ORDER BY name`),
  getScriptsByLicense: db.prepare(`
    SELECT s.* FROM scripts s
    INNER JOIN license_scripts ls ON s.id = ls.script_id
    WHERE ls.license_id = ?
  `),
  linkScriptToLicense: db.prepare(`
    INSERT OR IGNORE INTO license_scripts (license_id, script_id) VALUES (?, ?)
  `),

  // Whitelist
  addWhitelist: db.prepare(`
    INSERT INTO whitelist (discord_id, reason, expires_at, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET reason = excluded.reason, expires_at = excluded.expires_at, created_by = excluded.created_by
  `),
  removeWhitelist: db.prepare(`DELETE FROM whitelist WHERE discord_id = ?`),
  getWhitelist: db.prepare(`SELECT * FROM whitelist WHERE discord_id = ?`),
  getAllWhitelist: db.prepare(`SELECT * FROM whitelist ORDER BY created_at DESC`),

  // Blacklist
  addBlacklist: db.prepare(`
    INSERT INTO blacklist (type, value, reason, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(type, value) DO UPDATE SET reason = excluded.reason, expires_at = excluded.expires_at, created_by = excluded.created_by
  `),
  removeBlacklist: db.prepare(`DELETE FROM blacklist WHERE type = ? AND value = ?`),
  getBlacklist: db.prepare(`SELECT * FROM blacklist WHERE type = ? AND value = ?`),
  getAllBlacklist: db.prepare(`SELECT * FROM blacklist ORDER BY created_at DESC`),
  isBlacklisted: db.prepare(`
    SELECT * FROM blacklist WHERE type = ? AND value = ?
    AND (expires_at IS NULL OR expires_at > ?)
  `),

  // Logs
  addLog: db.prepare(`
    INSERT INTO logs (action, actor_id, target_id, details) VALUES (?, ?, ?, ?)
  `),
  getRecentLogs: db.prepare(`SELECT * FROM logs ORDER BY created_at DESC LIMIT ?`),

  // Settings
  getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  setSetting: db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `),

  // Stats
  countLicenses: db.prepare(`SELECT COUNT(*) as count FROM licenses`),
  countActiveLicenses: db.prepare(`SELECT COUNT(*) as count FROM licenses WHERE status = 'active'`),
  countUsers: db.prepare(`SELECT COUNT(*) as count FROM users`),
  countBlacklist: db.prepare(`SELECT COUNT(*) as count FROM blacklist`),
  countWhitelist: db.prepare(`SELECT COUNT(*) as count FROM whitelist`)
};

module.exports = { db, initDatabase, stmt };
