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
      tokensCount: 'GET /tokens/count'
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

    if (!token) {
      logger.warn('Token registration attempt without token');
      return res.status(400).json({ error: 'Token is required' });
    }

    // Valider le format du token Expo
    if (!token.startsWith('ExpoToken[') && !token.startsWith('ExpoPushToken[')) {
      logger.warn(`Invalid token format: ${token}`);
      return res.status(400).json({ error: 'Invalid Expo token format' });
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
