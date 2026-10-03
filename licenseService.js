const { stmt } = require('../database/db');
const { isExpired, formatExpiration, formatDate, calculateExpiration } = require('./duration');
const { generateLicenseKey } = require('./helpers');
const { log, Actions } = require('./logger');

/**
 * Vérifie si un utilisateur / licence / hwid est blacklisté
 */
function checkBlacklist(discordId, licenseKey = null, hwid = null) {
  const now = Date.now();

  if (discordId) {
    const bl = stmt.isBlacklisted.get('discord_id', discordId, now);
    if (bl) return { blocked: true, reason: bl.reason, type: 'discord_id' };
  }
  if (licenseKey) {
    const bl = stmt.isBlacklisted.get('license', licenseKey, now);
    if (bl) return { blocked: true, reason: bl.reason, type: 'license' };
  }
  if (hwid) {
    const bl = stmt.isBlacklisted.get('hwid', hwid, now);
    if (bl) return { blocked: true, reason: bl.reason, type: 'hwid' };
  }
  return { blocked: false };
}

/**
 * Vérifie si un utilisateur est whitelisté (et non expiré)
 */
function isWhitelisted(discordId) {
  const wl = stmt.getWhitelist.get(discordId);
  if (!wl) return false;
  if (wl.expires_at && isExpired(wl.expires_at)) return false;
  return true;
}

/**
 * Crée une nouvelle licence
 */
function createLicense({ durationStr, maxHwid = 1, maxHwidResets = 1, scriptIds = [], createdBy, note = null }) {
  const exp = calculateExpiration(durationStr);
  if (!exp) throw new Error('Durée invalide. Formats acceptés : 30m, 2h, 4d, 3w, 2mo, 365d, lifetime');

  const key = generateLicenseKey();
  // expires_at is null for lifetime, otherwise we store the duration label and set expires_at on activation
  // For unused licenses we store the duration, expires_at will be calculated on activation
  const result = stmt.createLicense.run(
    key,
    durationStr.trim().toLowerCase(),
    exp.label,
    null, // expires_at set on activation
    maxHwid,
    maxHwidResets,
    createdBy,
    note
  );

  const licenseId = result.lastInsertRowid;

  // Lier les scripts
  for (const scriptId of scriptIds) {
    stmt.linkScriptToLicense.run(licenseId, scriptId);
  }

  log(Actions.LICENSE_CREATED, createdBy, key, { duration: exp.label, maxHwid, maxHwidResets });

  return {
    id: licenseId,
    key,
    durationLabel: exp.label,
    isLifetime: exp.isLifetime,
    maxHwid,
    maxHwidResets
  };
}

/**
 * Active une licence pour un utilisateur
 */
function activateLicense(key, discordId, hwid = null, username = null) {
  // 1. Vérifier blacklist
  const bl = checkBlacklist(discordId, key, hwid);
  if (bl.blocked) {
    return { success: false, error: `Blacklisté (${bl.type}): ${bl.reason || 'Aucune raison'}` };
  }

  // 2. Récupérer la licence
  const license = stmt.getLicenseByKey.get(key);
  if (!license) {
    return { success: false, error: 'Licence introuvable.' };
  }

  if (license.status === 'revoked') {
    return { success: false, error: 'Cette licence a été révoquée.' };
  }

  if (license.status === 'active' && license.discord_id && license.discord_id !== discordId) {
    return { success: false, error: 'Cette licence est déjà activée par un autre utilisateur.' };
  }

  // 3. Calculer expiration
  let expiresAt = license.expires_at;
  if (license.status === 'unused') {
    // Première activation : calculer expires_at à partir de duration_raw
    const raw = license.duration_raw || license.duration_label;
    if (!raw || raw === 'Lifetime' || license.duration_label === 'Lifetime') {
      expiresAt = null;
    } else {
      const parsed = require('./duration').parseDuration(raw);
      if (parsed && !parsed.isLifetime) {
        expiresAt = Date.now() + parsed.ms;
      } else {
        expiresAt = null;
      }
    }
  } else if (isExpired(license.expires_at)) {
    return { success: false, error: 'Cette licence a expiré.' };
  }

  // 4. Gérer HWID
  if (hwid) {
    const activeCount = stmt.countActiveHwids.get(license.id).count;
    const existing = stmt.getHwidsByLicense.all(license.id).find(h => h.hwid === hwid);

    if (!existing && activeCount >= license.max_hwid) {
      return { success: false, error: `Nombre maximum de HWID atteint (${license.max_hwid}).` };
    }

    stmt.addHwid.run(license.id, hwid, Date.now(), Date.now());
    log(Actions.HWID_REGISTERED, discordId, hwid, { licenseKey: key });
  }

  // 5. Upsert user
  if (username) {
    stmt.upsertUser.run(discordId, username, Date.now());
  }

  // 6. Activer
  stmt.activateLicense.run(discordId, Date.now(), expiresAt, license.id);

  log(Actions.LICENSE_ACTIVATED, discordId, key, { hwid, expiresAt });

  return {
    success: true,
    license: {
      key: license.key,
      status: 'active',
      expiresAt,
      expiresLabel: formatExpiration(expiresAt),
      maxHwid: license.max_hwid,
      hwidResets: license.hwid_resets,
      maxHwidResets: license.max_hwid_resets
    }
  };
}

/**
 * Récupère les infos de licence d'un utilisateur
 */
function getUserLicense(discordId) {
  const licenses = stmt.getLicensesByDiscordId.all(discordId);
  const active = licenses.find(l => l.status === 'active' && !isExpired(l.expires_at));
  if (!active) return null;

  const hwids = stmt.getHwidsByLicense.all(active.id);
  const scripts = stmt.getScriptsByLicense.all(active.id);

  return {
    key: active.key,
    status: active.status,
    createdAt: formatDate(active.created_at),
    activatedAt: formatDate(active.activated_at),
    expiresAt: active.expires_at,
    expiresLabel: formatExpiration(active.expires_at),
    isLifetime: active.expires_at === null,
    maxHwid: active.max_hwid,
    hwidResets: active.hwid_resets,
    maxHwidResets: active.max_hwid_resets,
    hwids: hwids.map(h => ({ hwid: h.hwid, lastSeen: formatDate(h.last_seen) })),
    scripts: scripts.map(s => ({ id: s.id, name: s.name, status: s.status }))
  };
}

/**
 * Reset HWID d'une licence
 */
function resetHwid(licenseId, discordId) {
  const license = stmt.getLicenseById.get(licenseId);
  if (!license) return { success: false, error: 'Licence introuvable.' };
  if (license.discord_id !== discordId) return { success: false, error: 'Cette licence ne t\'appartient pas.' };
  if (license.status !== 'active') return { success: false, error: 'Licence non active.' };
  if (isExpired(license.expires_at)) return { success: false, error: 'Licence expirée.' };

  if (license.hwid_resets >= license.max_hwid_resets) {
    return { success: false, error: `Plus de resets HWID disponibles (${license.max_hwid_resets}).` };
  }

  stmt.deactivateAllHwids.run(licenseId);
  stmt.updateLicenseHwidResets.run(licenseId);

  log(Actions.HWID_RESET, discordId, license.key, { resetsLeft: license.max_hwid_resets - license.hwid_resets - 1 });

  return {
    success: true,
    resetsLeft: license.max_hwid_resets - license.hwid_resets - 1
  };
}

/**
 * Révoque une licence
 */
function revokeLicense(key, actorId) {
  const license = stmt.getLicenseByKey.get(key);
  if (!license) return { success: false, error: 'Licence introuvable.' };
  if (license.status === 'revoked') return { success: false, error: 'Déjà révoquée.' };

  stmt.revokeLicense.run(Date.now(), license.id);
  log(Actions.LICENSE_REVOKED, actorId, key);

  return { success: true };
}

/**
 * Vérifie une licence (pour l'API)
 */
function checkLicense(key, hwid = null, discordId = null) {
  const bl = checkBlacklist(discordId, key, hwid);
  if (bl.blocked) {
    return { valid: false, reason: `blacklisted:${bl.type}`, message: bl.reason };
  }

  const license = stmt.getLicenseByKey.get(key);
  if (!license) return { valid: false, reason: 'not_found' };
  if (license.status === 'revoked') return { valid: false, reason: 'revoked' };
  if (license.status === 'unused') return { valid: false, reason: 'not_activated' };
  if (isExpired(license.expires_at)) return { valid: false, reason: 'expired' };

  if (discordId && license.discord_id !== discordId) {
    return { valid: false, reason: 'discord_mismatch' };
  }

  if (hwid) {
    const hwids = stmt.getHwidsByLicense.all(license.id);
    const found = hwids.find(h => h.hwid === hwid);
    if (!found) {
      // Si encore de la place, on peut l'ajouter
      if (hwids.length < license.max_hwid) {
        stmt.addHwid.run(license.id, hwid, Date.now(), Date.now());
      } else {
        return { valid: false, reason: 'hwid_limit' };
      }
    } else {
      // Update last_seen
      stmt.addHwid.run(license.id, hwid, found.first_seen, Date.now());
    }
  }

  const scripts = stmt.getScriptsByLicense.all(license.id);

  return {
    valid: true,
    license: {
      key: license.key,
      status: 'active',
      expiresAt: license.expires_at,
      isLifetime: license.expires_at === null,
      discordId: license.discord_id,
      scripts: scripts.map(s => s.name)
    }
  };
}

module.exports = {
  checkBlacklist,
  isWhitelisted,
  createLicense,
  activateLicense,
  getUserLicense,
  resetHwid,
  revokeLicense,
  checkLicense
};
