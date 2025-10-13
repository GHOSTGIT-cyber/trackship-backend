const cron = require('node-cron');
const eurisApi = require('../services/eurisApi');
const notificationService = require('../services/notificationService');
const { logger } = require('../utils/logger');
const { BASE_COORDS, ZONES, CHECK_INTERVAL } = require('../config/constants');

// État en mémoire : Map<mmsi, shipData>
// Permet de garder trace des navires déjà vus pour ne notifier que les NOUVEAUX
const knownShips = new Map();

// Référence vers le cron job pour pouvoir l'arrêter
let cronJob = null;

// Référence vers le Set des tokens (passé depuis server.js)
let registeredTokensRef = null;

/**
 * Vérifier les navires et envoyer notifications si nécessaire
 */
async function checkShips() {
  try {
    logger.info('Starting ship check cycle');

    // Vérifier s'il y a des tokens enregistrés
    if (!registeredTokensRef || registeredTokensRef.size === 0) {
      logger.info('No registered tokens, skipping check');
      return;
    }

    // Récupérer les navires dans la zone 3km
    const ships = await eurisApi.fetchShips(
      BASE_COORDS.lat,
      BASE_COORDS.lon,
      ZONES.zone3
    );

    logger.info(`Found ${ships.length} ships in zone 3km`);

    // Créer un Set des MMSI actuellement dans la zone
    const currentShipMMSIs = new Set(ships.map(ship => ship.mmsi));

    // Détecter les NOUVEAUX navires
    const newShips = [];

    for (const ship of ships) {
      if (!knownShips.has(ship.mmsi)) {
        // Nouveau navire détecté !
        newShips.push(ship);
        logger.info(`New ship detected: ${ship.name} (${ship.mmsi}) at ${(ship.distance / 1000).toFixed(1)}km`);
      } else {
        // Navire déjà connu, mettre à jour ses infos
        knownShips.set(ship.mmsi, {
          ...ship,
          lastSeen: new Date()
        });
      }
    }

    // Nettoyer les navires qui ne sont plus dans la zone
    // (pour libérer la mémoire et permettre une nouvelle notification s'ils reviennent)
    const shipsToRemove = [];
    for (const [mmsi, shipData] of knownShips.entries()) {
      if (!currentShipMMSIs.has(mmsi)) {
        // Le navire n'est plus dans la zone
        const timeSinceLastSeen = Date.now() - new Date(shipData.lastSeen).getTime();

        // Supprimer après 5 minutes d'absence
        if (timeSinceLastSeen > 5 * 60 * 1000) {
          shipsToRemove.push(mmsi);
        }
      }
    }

    shipsToRemove.forEach(mmsi => {
      const ship = knownShips.get(mmsi);
      logger.info(`Removing ship from memory: ${ship.name} (${mmsi})`);
      knownShips.delete(mmsi);
    });

    // Ajouter les nouveaux navires à la Map
    for (const ship of newShips) {
      knownShips.set(ship.mmsi, {
        ...ship,
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }

    // Envoyer notifications pour les nouveaux navires
    if (newShips.length > 0) {
      logger.info(`Sending notifications for ${newShips.length} new ship(s)`);

      const tokens = Array.from(registeredTokensRef);

      for (const ship of newShips) {
        await notificationService.sendShipDetectedNotification(
          tokens,
          ship,
          ship.distance
        );
      }
    }

    logger.info('Ship check cycle completed', {
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
      mmsi: ship.mmsi,
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
