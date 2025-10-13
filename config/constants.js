/**
 * Constantes de configuration pour TrackShip backend
 * Ces valeurs peuvent être surchargées par les variables d'environnement
 */

// Coordonnées de base (peuvent être surchargées par .env)
const BASE_COORDS = {
  lat: parseFloat(process.env.BASE_LAT) || 48.853229,
  lon: parseFloat(process.env.BASE_LON) || 2.225328
};

// Définition des zones de détection (en mètres)
const ZONES = {
  zone1: 1000,  // 1km
  zone2: 2000,  // 2km
  zone3: 3000   // 3km - zone de notification
};

// Intervalle de vérification des navires (en millisecondes)
// Par défaut : 30 secondes
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 30000;

// Configuration API EuRIS
const EURIS_CONFIG = {
  apiUrl: process.env.EURIS_API_URL || 'https://bakabi.fr/trackship/api/euris-proxy.php',
  timeout: 10000, // 10 secondes
  retryAttempts: 3,
  retryDelay: 2000 // 2 secondes entre les tentatives
};

// Configuration des notifications
const NOTIFICATION_CONFIG = {
  maxTokensPerRequest: 100, // Limite Expo
  soundEnabled: true,
  vibrationEnabled: true,
  priorityHigh: true,
  channelId: 'default'
};

// Configuration du serveur
const SERVER_CONFIG = {
  port: parseInt(process.env.PORT) || 3000,
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limite de 100 requêtes par fenêtre
  }
};

// Durée de conservation des navires en mémoire (en millisecondes)
// Un navire qui quitte la zone reste en mémoire pendant cette durée
// pour éviter d'envoyer une notification s'il revient immédiatement
const SHIP_MEMORY_DURATION = 5 * 60 * 1000; // 5 minutes

// Niveaux de log selon l'environnement
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

module.exports = {
  BASE_COORDS,
  ZONES,
  CHECK_INTERVAL,
  EURIS_CONFIG,
  NOTIFICATION_CONFIG,
  SERVER_CONFIG,
  SHIP_MEMORY_DURATION,
  LOG_LEVEL
};
