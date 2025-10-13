/**
 * Simple logger utility pour TrackShip backend
 * Log vers la console avec timestamps et niveaux
 * En production avec PM2, les logs seront capturés automatiquement
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Niveau de log actuel (basé sur NODE_ENV)
const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

/**
 * Formater un message de log
 * @param {string} level - Niveau du log
 * @param {string} message - Message principal
 * @param {object} meta - Métadonnées additionnelles
 * @returns {string} Message formaté
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * Logger ERROR
 * @param {string} message
 * @param {Error|object} error - Erreur ou métadonnées
 */
function error(message, error = {}) {
  if (currentLevel >= LOG_LEVELS.ERROR) {
    if (error instanceof Error) {
      console.error(formatLog('ERROR', message, {
        error: error.message,
        stack: error.stack
      }));
    } else {
      console.error(formatLog('ERROR', message, error));
    }
  }
}

/**
 * Logger WARN
 * @param {string} message
 * @param {object} meta - Métadonnées
 */
function warn(message, meta = {}) {
  if (currentLevel >= LOG_LEVELS.WARN) {
    console.warn(formatLog('WARN', message, meta));
  }
}

/**
 * Logger INFO
 * @param {string} message
 * @param {object} meta - Métadonnées
 */
function info(message, meta = {}) {
  if (currentLevel >= LOG_LEVELS.INFO) {
    console.log(formatLog('INFO', message, meta));
  }
}

/**
 * Logger DEBUG
 * @param {string} message
 * @param {object} meta - Métadonnées
 */
function debug(message, meta = {}) {
  if (currentLevel >= LOG_LEVELS.DEBUG) {
    console.log(formatLog('DEBUG', message, meta));
  }
}

/**
 * Logger pour les requêtes HTTP
 * @param {string} method - Méthode HTTP
 * @param {string} path - Chemin
 * @param {number} status - Code status
 * @param {number} duration - Durée en ms
 */
function http(method, path, status, duration) {
  const statusColor = status >= 500 ? 'ERROR' :
                      status >= 400 ? 'WARN' :
                      'INFO';

  const message = `${method} ${path} ${status} - ${duration}ms`;

  if (statusColor === 'ERROR') {
    error(message);
  } else if (statusColor === 'WARN') {
    warn(message);
  } else {
    info(message);
  }
}

// Créer l'objet logger à exporter
const logger = {
  error,
  warn,
  info,
  debug,
  http,
  // Exporter les niveaux pour référence
  levels: LOG_LEVELS
};

module.exports = {
  logger
};
