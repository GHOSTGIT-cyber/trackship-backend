const cron = require('node-cron');
const eurisApi = require('../services/eurisApi');
const notificationService = require('../services/notificationService');
const { logger } = require('../utils/logger');
const { BASE_COORDS, ZONES, CHECK_INTERVAL } = require('../config/constants');

// État en mémoire : Map<trackId, shipData>
// Permet de garder trace des navires déjà vus pour ne notifier que les NOUVEAUX
// Utilise trackId car mmsi est souvent vide dans les données EuRIS
const knownShips = new Map();

// Référence vers le cron job pour pouvoir l'arrêter
let cronJob = null;

// Référence vers le Set des tokens (passé depuis server.js)
let registeredTokensRef = null;

// Statistiques globales du worker (accessibles via /debug/notifications)
if (!global.workerStats) {
  global.workerStats = {
    lastRun: null,
    totalChecks: 0,
    shipsFound: 0,
    notificationsSent: 0
  };
}
global.workerRunning = false;

/**
 * Vérifier les navires et envoyer notifications si nécessaire
 */
async function checkShips() {
  try {
    global.workerStats.totalChecks++;
    global.workerStats.lastRun = new Date().toISOString();

    logger.info(`\n🔍 Worker check #${global.workerStats.totalChecks}...`);
    logger.info('Starting ship check cycle');

    // Vérifier s'il y a des tokens enregistrés
    if (!registeredTokensRef || registeredTokensRef.size === 0) {
      logger.info('No registered tokens, skipping check');
      return;
    }

    logger.info(`📱 Tokens enregistrés: ${registeredTokensRef.size}`);

    // Récupérer les navires dans la zone 3km
    const ships = await eurisApi.fetchShips(
      BASE_COORDS.lat,
      BASE_COORDS.lon,
      ZONES.zone3
    );

    logger.info(`🚢 Found ${ships.length} ships in zone 3km`);
    global.workerStats.shipsFound = ships.length;

    // Créer un Set des trackId actuellement dans la zone
    const currentShipTrackIds = new Set(ships.map(ship => ship.trackId));

    // Détecter les NOUVEAUX navires
    const newShips = [];

    for (const ship of ships) {
      if (!knownShips.has(ship.trackId)) {
        // Nouveau navire détecté !
        newShips.push(ship);
        logger.info(`🚢 Nouveau navire détecté: ${ship.name} (trackId: ${ship.trackId}) à ${(ship.distance / 1000).toFixed(1)}km`);
      } else {
        // Navire déjà connu, mettre à jour ses infos
        knownShips.set(ship.trackId, {
          ...ship,
          lastSeen: new Date()
        });
      }
    }

    // Nettoyer les navires qui ne sont plus dans la zone
    // (pour libérer la mémoire et permettre une nouvelle notification s'ils reviennent)
    const shipsToRemove = [];
    for (const [trackId, shipData] of knownShips.entries()) {
      if (!currentShipTrackIds.has(trackId)) {
        // Le navire n'est plus dans la zone
        const timeSinceLastSeen = Date.now() - new Date(shipData.lastSeen).getTime();

        // Supprimer après 5 minutes d'absence
        if (timeSinceLastSeen > 5 * 60 * 1000) {
          shipsToRemove.push(trackId);
        }
      }
    }

    shipsToRemove.forEach(trackId => {
      const ship = knownShips.get(trackId);
      logger.info(`Navire retiré de la mémoire: ${ship.name} (trackId: ${trackId})`);
      knownShips.delete(trackId);
    });

    // Ajouter les nouveaux navires à la Map
    for (const ship of newShips) {
      knownShips.set(ship.trackId, {
        ...ship,
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }

    // Envoyer notifications pour les nouveaux navires
    if (newShips.length > 0) {
      logger.info(`📨 Sending notifications for ${newShips.length} new ship(s)`);

      const tokens = Array.from(registeredTokensRef);

      for (const ship of newShips) {
        logger.info(`  → Sending notification for ${ship.name} (${ship.trackId})`);
        await notificationService.sendShipDetectedNotification(
          tokens,
          ship,
          ship.distance
        );
        global.workerStats.notificationsSent++;
      }

      logger.info(`✅ Notifications sent: ${newShips.length}`);
    } else {
      logger.info('ℹ️  No new ships detected, no notifications sent');
    }

    logger.info('✅ Ship check cycle completed', {
      totalShips: ships.length,
      newShips: newShips.length,
      knownShips: knownShips.size,
      removedShips: shipsToRemove.length
    });

  } catch (error) {
    logger.error('Error in checkShips:', error);
  }
}

/**
 * Démarrer le worker de vérification des navires
 * @param {Set} registeredTokens - Référence vers le Set des tokens enregistrés
 */
function start(registeredTokens) {
  if (cronJob) {
    logger.warn('Ship checker already running');
    return;
  }

  registeredTokensRef = registeredTokens;

  // Convertir l'intervalle en secondes pour cron
  const intervalSeconds = CHECK_INTERVAL / 1000;

  // Cron expression pour toutes les X secondes
  // Format : */30 * * * * * = toutes les 30 secondes
  const cronExpression = `*/${intervalSeconds} * * * * *`;

  logger.info(`Starting ship checker with interval: ${intervalSeconds}s`);

  cronJob = cron.schedule(cronExpression, async () => {
    await checkShips();
  });

  global.workerRunning = true;

  // Faire un premier check immédiatement au démarrage (après 5 secondes)
  setTimeout(async () => {
    logger.info('Initial ship check');
    await checkShips();
  }, 5000);

  logger.info('Ship checker worker started successfully');
}

/**
 * Arrêter le worker
 */
function stop() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    global.workerRunning = false;
    logger.info('Ship checker worker stopped');
  }
}

/**
 * Obtenir les statistiques du worker
 */
function getStats() {
  return {
    isRunning: cronJob !== null,
    knownShipsCount: knownShips.size,
    knownShips: Array.from(knownShips.values()).map(ship => ({
      trackId: ship.trackId,
      name: ship.name,
      distance: ship.distance,
      firstSeen: ship.firstSeen,
      lastSeen: ship.lastSeen
    }))
  };
}

module.exports = {
  start,
  stop,
  checkShips,
  getStats
};
