const { Expo } = require('expo-server-sdk');
const { logger } = require('../utils/logger');

// Créer un client Expo SDK
const expo = new Expo();

/**
 * Envoyer une notification push à un ou plusieurs tokens Expo
 * @param {string[]} tokens - Array de tokens Expo (ExpoToken[...])
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données additionnelles (optionnel)
 * @returns {Promise<object>} - Résultats de l'envoi
 */
async function sendPushNotification(tokens, title, body, data = {}) {
  try {
    // Filtrer les tokens invalides
    const validTokens = tokens.filter(token => {
      if (!Expo.isExpoPushToken(token)) {
        logger.warn(`Invalid Expo push token: ${token}`);
        return false;
      }
      return true;
    });

    if (validTokens.length === 0) {
      logger.warn('No valid tokens to send notification to');
      return {
        success: false,
        message: 'No valid tokens',
        sent: 0
      };
    }

    // Créer les messages
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default'
    }));

    logger.info(`Preparing to send ${messages.length} notifications`, {
      title,
      tokens: validTokens.length
    });

    // Diviser en chunks (Expo recommande max 100 par requête)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Envoyer chaque chunk
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        logger.info(`Sent chunk of ${chunk.length} notifications`);
      } catch (error) {
        logger.error('Error sending notification chunk:', error);
      }
    }

    // Analyser les résultats
    const results = {
      success: true,
      sent: 0,
      errors: 0,
      invalidTokens: []
    };

    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error') {
        results.errors++;
        logger.error(`Notification error for token ${validTokens[index]}:`, {
          message: ticket.message,
          details: ticket.details
        });

        // Si le token est invalide, le marquer pour suppression
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          results.invalidTokens.push(validTokens[index]);
        }
      } else {
        results.sent++;
      }
    });

    logger.info(`Notification sending complete`, {
      sent: results.sent,
      errors: results.errors,
      invalidTokens: results.invalidTokens.length
    });

    return results;

  } catch (error) {
    logger.error('Error in sendPushNotification:', error);
    return {
      success: false,
      message: error.message,
      sent: 0
    };
  }
}

/**
 * Envoyer une notification de nouveau navire détecté
 * @param {string[]} tokens - Tokens des utilisateurs à notifier
 * @param {object} ship - Données du navire
 * @param {number} distance - Distance en mètres
 */
async function sendShipDetectedNotification(tokens, ship, distance) {
  const distanceKm = (distance / 1000).toFixed(1);

  const title = '🚢 Nouveau navire détecté !';
  const body = `${ship.name || 'Navire inconnu'} est à ${distanceKm}km de votre position`;

  const data = {
    type: 'ship_detected',
    ship: {
      mmsi: ship.mmsi,
      name: ship.name,
      lat: ship.lat,
      lon: ship.lon,
      course: ship.course,
      speed: ship.speed,
      heading: ship.heading
    },
    distance: distance,
    timestamp: new Date().toISOString()
  };

  return await sendPushNotification(tokens, title, body, data);
}

module.exports = {
  sendPushNotification,
  sendShipDetectedNotification
};
