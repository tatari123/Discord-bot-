const express = require('express');
const cors = require('cors');
const { activateLicense, checkLicense, resetHwid, getUserLicense } = require('../utils/licenseService');
const { stmt } = require('../database/db');
const { log, Actions } = require('../utils/logger');

function createApiServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Middleware simple de log
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Lua Protector API', timestamp: Date.now() });
  });

  /**
   * POST /api/license/activate
   * Body: { key, discordId, hwid?, username? }
   */
  app.post('/api/license/activate', (req, res) => {
    try {
      const { key, discordId, hwid, username } = req.body;

      if (!key || !discordId) {
        return res.status(400).json({ success: false, error: 'key et discordId requis' });
      }

      const result = activateLicense(key, discordId, hwid || null, username || null);

      if (!result.success) {
        log(Actions.API_ERROR, discordId, key, { action: 'activate', error: result.error });
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (err) {
      console.error('[API] activate error:', err);
      log(Actions.API_ERROR, null, null, { action: 'activate', error: err.message });
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * POST /api/license/check
   * Body: { key, hwid?, discordId? }
   */
  app.post('/api/license/check', (req, res) => {
    try {
      const { key, hwid, discordId } = req.body;

      if (!key) {
        return res.status(400).json({ valid: false, reason: 'key_required' });
      }

      const result = checkLicense(key, hwid || null, discordId || null);
      return res.json(result);
    } catch (err) {
      console.error('[API] check error:', err);
      log(Actions.API_ERROR, null, null, { action: 'check', error: err.message });
      return res.status(500).json({ valid: false, reason: 'server_error' });
    }
  });

  /**
   * POST /api/license/reset-hwid
   * Body: { key, discordId }
   */
  app.post('/api/license/reset-hwid', (req, res) => {
    try {
      const { key, discordId } = req.body;

      if (!key || !discordId) {
        return res.status(400).json({ success: false, error: 'key et discordId requis' });
      }

      const license = stmt.getLicenseByKey.get(key);
      if (!license) {
        return res.status(404).json({ success: false, error: 'Licence introuvable' });
      }

      const result = resetHwid(license.id, discordId);
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (err) {
      console.error('[API] reset-hwid error:', err);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * GET /api/license/info/:discordId
   * Info publique limitée (pour debug)
   */
  app.get('/api/license/info/:discordId', (req, res) => {
    try {
      const info = getUserLicense(req.params.discordId);
      if (!info) {
        return res.status(404).json({ found: false });
      }
      // Ne pas exposer la clé complète
      return res.json({
        found: true,
        status: info.status,
        expiresLabel: info.expiresLabel,
        isLifetime: info.isLifetime,
        scripts: info.scripts.map(s => s.name)
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint introuvable' });
  });

  return app;
}

module.exports = { createApiServer };
