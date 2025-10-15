require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger } = require('./utils/logger');
const notificationService = require('./services/notificationService');
const eurisApi = require('./services/eurisApi');
const shipChecker = require('./workers/shipChecker');

const app = express();
const PORT = process.env.PORT || 3000;

// Stockage en mémoire des tokens Expo
// Format : Set de strings (ExpoToken[...])
const registeredTokens = new Set();

// Middleware
app.use(cors());
app.use(express.json());

// Logger middleware - log toutes les requêtes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Routes

/**
 * Root endpoint - simple health check for Railway
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    name: 'TrackShip Backend API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      registerToken: 'POST /register-token',
      unregisterToken: 'POST /unregister-token',
      ships: 'GET /ships',
      tokensCount: 'GET /tokens/count',
      demoShipAlert: 'POST /demo/ship-alert',
      demoInfo: 'GET /demo/info',
      debugNotifications: 'GET /debug/notifications'
    }
  });
});

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    registeredTokens: registeredTokens.size
  });
});

/**
 * Enregistrer un token Expo pour recevoir des notifications
 * POST /register-token
 * Body: { token: "ExpoToken[...]" }
 */
app.post('/register-token', async (req, res) => {
  try {
    const { token } = req.body;

    // Validation token : vérifier que c'est une string non vide
    if (!token || typeof token !== 'string') {
      logger.warn('Token registration attempt without token');
      return res.status(400).json({ error: 'Token manquant' });
    }

    // Vérifier format de base Expo
    const startsCorrectly = token.startsWith('ExponentPushToken[') ||
                            token.startsWith('ExpoPushToken[') ||
                            token.startsWith('ExpoToken[');
    const endsCorrectly = token.endsWith(']');
    const hasMinLength = token.length >= 20;

    if (!startsCorrectly || !endsCorrectly || !hasMinLength) {
      logger.warn(`Invalid token format: ${token}`);
      return res.status(400).json({
        error: 'Format token invalide',
        expected: 'ExponentPushToken[xxx], ExpoPushToken[xxx] ou ExpoToken[xxx] (min 20 caractères)',
        received: token.substring(0, 30) + '...'
      });
    }

    registeredTokens.add(token);
    logger.info(`Token registered successfully: ${token}`, {
      totalTokens: registeredTokens.size
    });

    // Envoyer notification de test
    await notificationService.sendPushNotification(
      [token],
      'TrackShip activé',
      'Vous recevrez des notifications quand un navire entre dans la zone de 3km',
      { type: 'registration_confirmation' }
    );

    res.json({
      success: true,
      message: 'Token registered successfully',
      totalTokens: registeredTokens.size
    });
  } catch (error) {
    logger.error('Error registering token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

/**
 * Désinscrire un token Expo
 * POST /unregister-token
 * Body: { token: "ExpoToken[...]" }
 */
app.post('/unregister-token', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const wasDeleted = registeredTokens.delete(token);

    if (wasDeleted) {
      logger.info(`Token unregistered: ${token}`, {
        totalTokens: registeredTokens.size
      });
    } else {
      logger.warn(`Attempted to unregister unknown token: ${token}`);
    }

    res.json({
      success: true,
      message: wasDeleted ? 'Token unregistered successfully' : 'Token was not registered',
      totalTokens: registeredTokens.size
    });
  } catch (error) {
    logger.error('Error unregistering token:', error);
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

/**
 * Récupérer les navires dans les différentes zones
 * GET /ships
 */
app.get('/ships', async (req, res) => {
  try {
    const BASE_LAT = parseFloat(process.env.BASE_LAT);
    const BASE_LON = parseFloat(process.env.BASE_LON);
    const RADIUS_KM = 5; // Récupérer dans un rayon de 5km

    logger.info(`Fetching ships in ${RADIUS_KM}km radius`, { BASE_LAT, BASE_LON });

    // Récupérer les navires dans un rayon de 5km
    const ships = await eurisApi.fetchShips(BASE_LAT, BASE_LON, RADIUS_KM * 1000);

    // Filtrer par zones
    const zone1 = ships.filter(s => s.distance <= 1000);
    const zone2 = ships.filter(s => s.distance > 1000 && s.distance <= 2000);
    const zone3 = ships.filter(s => s.distance > 2000 && s.distance <= 3000);
    const beyond = ships.filter(s => s.distance > 3000);

    // Préparer la réponse avec les navires formatés
    const formattedShips = ships.map(s => ({
      trackId: s.trackId,
      name: s.name,
      distance: Math.round(s.distance),
      distanceKm: (s.distance / 1000).toFixed(2),
      moving: s.moving,
      course: s.course,
      speed: s.speed ? s.speed.toFixed(1) : null,
      heading: s.heading,
      lat: s.lat,
      lon: s.lon
    }));

    logger.info(`Ships retrieved: ${ships.length} total, Zone1: ${zone1.length}, Zone2: ${zone2.length}, Zone3: ${zone3.length}`);

    res.json({
      success: true,
      total: ships.length,
      zones: {
        zone1km: zone1.length,
        zone2km: zone2.length,
        zone3km: zone3.length,
        beyond3km: beyond.length
      },
      ships: formattedShips
    });
  } catch (error) {
    logger.error('Erreur route /ships:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get registered tokens count (debug)
 * GET /tokens/count
 */
app.get('/tokens/count', (req, res) => {
  res.json({
    count: registeredTokens.size,
    tokens: Array.from(registeredTokens).map(t => t.substring(0, 20) + '...')
  });
});

// ============================================
// ROUTES DE DÉMO (pour tests)
// ============================================

/**
 * Route de test pour démo
 * Simule un navire dans zone rouge + envoie notification
 * POST /demo/ship-alert
 *
 * IMPORTANT : Route ISOLÉE qui n'affecte PAS le worker automatique
 */
app.post('/demo/ship-alert', async (req, res) => {
  try {
    // Vérifier qu'il y a au moins un appareil enregistré
    if (registeredTokens.size === 0) {
      return res.status(400).json({
        error: 'Aucun appareil enregistré pour les notifications',
        info: 'Installez l\'app et activez les notifications d\'abord',
        howTo: 'POST /register-token avec votre token Expo'
      });
    }

    // Navire fictif dans zone ROUGE (< 1km)
    const demoShip = {
      trackId: 'DEMO-FOIL-2025',
      name: 'Foil\'in Paris Demo',
      lat: 48.854, // Près de la base (Tour Eiffel)
      lon: 2.226,
      distance: 850, // Zone rouge : 850 mètres
      speed: 12.5, // 12.5 km/h
      course: 45, // Direction Nord-Est
      heading: 42,
      length: 110,
      width: 11.4,
      moving: true,
      positionISRS: 'Seine km 42.5',
      timestamp: new Date().toISOString()
    };

    // Préparer les tokens
    const tokens = Array.from(registeredTokens);

    // Envoyer notification push
    const notifTitle = '🚢 Nouveau navire détecté !';
    const notifBody = `${demoShip.name} (${demoShip.length}m) à ${Math.round(demoShip.distance)}m - Vitesse ${demoShip.speed} km/h`;

    const result = await notificationService.sendPushNotification(
      tokens,
      notifTitle,
      notifBody,
      {
        type: 'ship_detected',
        ship: demoShip,
        zone: 'red',
        demo: true
      }
    );

    logger.info(`🎬 DÉMO : Notification envoyée à ${tokens.length} appareil(s)`, {
      ship: demoShip.name,
      distance: demoShip.distance,
      recipients: tokens.length
    });

    res.json({
      success: true,
      message: 'Notification de démo envoyée avec succès',
      recipients: tokens.length,
      notificationResult: {
        sent: result.sent,
        errors: result.errors
      },
      ship: {
        name: demoShip.name,
        distance: `${Math.round(demoShip.distance)}m`,
        zone: 'ROUGE (< 1km)',
        speed: `${demoShip.speed} km/h`,
        length: `${demoShip.length}m`
      },
      info: 'Le navire apparaîtra dans l\'app pendant quelques secondes'
    });

  } catch (error) {
    logger.error('Erreur route démo:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'envoi de la démo',
      details: error.message
    });
  }
});

/**
 * Informations sur la route de démo
 * GET /demo/info
 */
app.get('/demo/info', (req, res) => {
  res.json({
    title: 'Route de démo TrackShip',
    description: 'Simule un navire dans la zone rouge (< 1km) et envoie une notification push',
    endpoints: {
      demo: 'POST /demo/ship-alert',
      info: 'GET /demo/info'
    },
    usage: {
      method: 'POST',
      url: 'https://api.bakabi.fr/demo/ship-alert',
      example: 'curl -X POST https://api.bakabi.fr/demo/ship-alert'
    },
    requirements: 'Au moins 1 appareil avec notifications activées (token enregistré)',
    features: [
      'Navire fictif : Foil\'in Paris Demo (110m)',
      'Distance : 850m (zone rouge)',
      'Vitesse : 12.5 km/h',
      'Notification push envoyée à tous les appareils enregistrés'
    ],
    note: 'Cette route est ISOLÉE et n\'affecte PAS le worker automatique de détection',
    registeredTokens: registeredTokens.size
  });
});

// ============================================
// ROUTE DEBUG NOTIFICATIONS
// ============================================

/**
 * Route pour débugger l'état des notifications
 * Affiche tokens enregistrés + dernières activités worker
 * GET /debug/notifications
 */
app.get('/debug/notifications', (req, res) => {
  try {
    // Récupérer les tokens
    const tokens = Array.from(registeredTokens);

    // Infos worker (si disponible)
    const workerStats = global.workerStats || {
      lastRun: 'Jamais',
      totalChecks: 0,
      shipsFound: 0,
      notificationsSent: 0
    };

    res.json({
      notifications: {
        tokensRegistered: tokens.length,
        tokens: tokens.map(t => ({
          preview: t.substring(0, 30) + '...',
          full: t
        }))
      },
      worker: {
        running: global.workerRunning || false,
        lastRun: workerStats.lastRun,
        totalChecks: workerStats.totalChecks,
        shipsFound: workerStats.shipsFound,
        notificationsSent: workerStats.notificationsSent
      },
      backend: {
        uptime: Math.round(process.uptime()),
        uptimeFormatted: `${Math.floor(process.uptime() / 60)}min ${Math.floor(process.uptime() % 60)}s`,
        nodeEnv: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error in debug route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 TrackShip backend server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Base coordinates: ${process.env.BASE_LAT}, ${process.env.BASE_LON}`);

  // Logger l'URL Railway si disponible
  if (process.env.RAILWAY_STATIC_URL) {
    logger.info(`🌐 Railway URL: https://${process.env.RAILWAY_STATIC_URL}`);
  }

  // Démarrer le worker de vérification des navires
  shipChecker.start(registeredTokens);
  logger.info('✅ Ship checker worker started');
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  shipChecker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  shipChecker.stop();
  process.exit(0);
});
