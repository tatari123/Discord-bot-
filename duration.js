/**
 * Parser de durée robuste pour Lua Protector
 * Formats supportés : 30m, 2h, 4d, 3w, 2mo, 365d, lifetime
 */

const MULTIPLIERS = {
  m: 60 * 1000,           // minutes
  h: 60 * 60 * 1000,      // heures
  d: 24 * 60 * 60 * 1000, // jours
  w: 7 * 24 * 60 * 60 * 1000, // semaines
  mo: 30 * 24 * 60 * 60 * 1000, // mois (30 jours)
  y: 365 * 24 * 60 * 60 * 1000  // années
};

/**
 * Parse une chaîne de durée en millisecondes
 * @param {string} input - Ex: "30m", "2h", "4d", "3w", "2mo", "365d", "lifetime"
 * @returns {{ ms: number|null, isLifetime: boolean, label: string } | null}
 */
function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;

  const cleaned = input.trim().toLowerCase();

  if (cleaned === 'lifetime' || cleaned === 'permanent' || cleaned === 'perm' || cleaned === '∞') {
    return { ms: null, isLifetime: true, label: 'Lifetime' };
  }

  // Regex : nombre + unité (m, h, d, w, mo, y)
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*(mo|m|h|d|w|y)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (isNaN(value) || value <= 0) return null;
  if (!MULTIPLIERS[unit]) return null;

  const ms = Math.floor(value * MULTIPLIERS[unit]);
  const label = formatDurationLabel(value, unit);

  return { ms, isLifetime: false, label };
}

/**
 * Formate un label lisible
 */
function formatDurationLabel(value, unit) {
  const labels = {
    m: value === 1 ? '1 minute' : `${value} minutes`,
    h: value === 1 ? '1 heure' : `${value} heures`,
    d: value === 1 ? '1 jour' : `${value} jours`,
    w: value === 1 ? '1 semaine' : `${value} semaines`,
    mo: value === 1 ? '1 mois' : `${value} mois`,
    y: value === 1 ? '1 année' : `${value} années`
  };
  return labels[unit] || `${value}${unit}`;
}

/**
 * Calcule la date d'expiration à partir de maintenant
 * @param {string} durationStr
 * @returns {{ expiresAt: number|null, isLifetime: boolean, label: string } | null}
 */
function calculateExpiration(durationStr) {
  const parsed = parseDuration(durationStr);
  if (!parsed) return null;

  if (parsed.isLifetime) {
    return { expiresAt: null, isLifetime: true, label: 'Lifetime' };
  }

  return {
    expiresAt: Date.now() + parsed.ms,
    isLifetime: false,
    label: parsed.label
  };
}

/**
 * Vérifie si une date d'expiration est passée
 * @param {number|null} expiresAt - timestamp ms ou null (lifetime)
 * @returns {boolean}
 */
function isExpired(expiresAt) {
  if (expiresAt === null || expiresAt === undefined) return false; // lifetime
  return Date.now() > expiresAt;
}

/**
 * Formate une date d'expiration pour affichage
 * @param {number|null} expiresAt
 * @returns {string}
 */
function formatExpiration(expiresAt) {
  if (expiresAt === null || expiresAt === undefined) return 'Lifetime';
  if (isExpired(expiresAt)) return 'Expiré';

  const remaining = expiresAt - Date.now();
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 30) {
    return new Date(expiresAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} heure${hours > 1 ? 's' : ''}`;
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/**
 * Formate un timestamp en date lisible
 */
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

module.exports = {
  parseDuration,
  calculateExpiration,
  isExpired,
  formatExpiration,
  formatDate
};
