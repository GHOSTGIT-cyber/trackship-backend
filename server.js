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
 * Proxy vers EuRIS API pour debug
 * GET /ships?lat=48.853229&lon=2.225328&radius=5000
 */
app.get('/ships', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || parseFloat(process.env.BASE_LAT);
    const lon = parseFloat(req.query.lon) || parseFloat(process.env.BASE_LON);
    const radius = parseInt(req.query.radius) || 5000;

    logger.info(`Fetching ships for debug`, { lat, lon, radius });

    const ships = await eurisApi.fetchShips(lat, lon, radius);

    res.json({
      success: true,
      count: ships.length,
      ships
    });
  } catch (error) {
    logger.error('Error fetching ships:', error);
    res.status(500).json({ error: 'Failed to fetch ships' });
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
app.listen(PORT, () => {
  logger.info(`🚀 TrackShip backend server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Base coordinates: ${process.env.BASE_LAT}, ${process.env.BASE_LON}`);

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
