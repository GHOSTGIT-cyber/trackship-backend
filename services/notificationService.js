const { Expo } = require('expo-server-sdk');
const { logger } = require('../utils/logger');
const { isFCMToken, sendFCMNotifications } = require('./firebaseService');

// Créer un client Expo SDK
const expo = new Expo();

/**
 * Envoyer une notification push à un ou plusieurs tokens (Expo ou FCM natif)
 * Détecte automatiquement le type de token et utilise le bon service
 * @param {string[]} tokens - Array de tokens (Expo ou FCM)
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données additionnelles (optionnel)
 * @returns {Promise<object>} - Résultats de l'envoi
 */
async function sendPushNotification(tokens, title, body, data = {}) {
  try {
    logger.info(`\n📧 sendPushNotification called:`, {
      tokensCount: tokens.length,
      title,
      body: body.substring(0, 50) + '...',
      dataKeys: Object.keys(data)
    });

    // Séparer les tokens Expo des tokens FCM natifs
    const expoTokens = [];
    const fcmTokens = [];

    tokens.forEach(token => {
      if (isFCMToken(token)) {
        logger.info(`📱 Detected FCM native token: ${token.substring(0, 30)}...`);
        fcmTokens.push(token);
      } else {
        logger.info(`📱 Detected Expo token: ${token.substring(0, 30)}...`);
        expoTokens.push(token);
      }
    });

    logger.info(`📋 Token distribution: ${expoTokens.length} Expo, ${fcmTokens.length} FCM native`);

    // Résultats combinés
    const combinedResults = {
      success: true,
      sent: 0,
      errors: 0,
      invalidTokens: [],
      expoResults: null,
      fcmResults: null
    };

    // Envoyer aux tokens Expo si présents
    if (expoTokens.length > 0) {
      logger.info(`\n📤 Sending to ${expoTokens.length} Expo token(s)...`);
      const expoResults = await sendExpoNotifications(expoTokens, title, body, data);
      combinedResults.expoResults = expoResults;
      combinedResults.sent += expoResults.sent;
      combinedResults.errors += expoResults.errors;
      combinedResults.invalidTokens.push(...expoResults.invalidTokens);
    }

    // Envoyer aux tokens FCM natifs si présents
    if (fcmTokens.length > 0) {
      logger.info(`\n📤 Sending to ${fcmTokens.length} FCM native token(s)...`);
      const fcmResults = await sendFCMNotifications(fcmTokens, title, body, data);
      combinedResults.fcmResults = fcmResults;
      combinedResults.sent += fcmResults.sent;
      combinedResults.errors += fcmResults.errors;
      combinedResults.invalidTokens.push(...fcmResults.invalidTokens);
    }

    logger.info(`\n✅ Combined notification sending complete`, {
      totalSent: combinedResults.sent,
      totalErrors: combinedResults.errors,
      invalidTokens: combinedResults.invalidTokens.length,
      expoSent: combinedResults.expoResults?.sent || 0,
      fcmSent: combinedResults.fcmResults?.sent || 0
    });

    return combinedResults;

  } catch (error) {
    logger.error('Error in sendPushNotification:', error);
    return {
      success: false,
      message: error.message,
      sent: 0,
      errors: 1
    };
  }
}

/**
 * Envoyer une notification push aux tokens Expo uniquement
 * @param {string[]} tokens - Array de tokens Expo (ExpoToken[...])
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données additionnelles (optionnel)
 * @returns {Promise<object>} - Résultats de l'envoi
 */
async function sendExpoNotifications(tokens, title, body, data = {}) {
  try {
    // Filtrer les tokens invalides
    const validTokens = tokens.filter(token => {
      if (!Expo.isExpoPushToken(token)) {
        logger.warn(`❌ Invalid Expo push token: ${token}`);
        return false;
      }
      logger.info(`✅ Valid Expo token: ${token.substring(0, 30)}...`);
      return true;
    });

    if (validTokens.length === 0) {
      logger.warn('⚠️  No valid Expo tokens to send notification to');
      return {
        success: false,
        message: 'No valid tokens',
        sent: 0,
        errors: 0,
        invalidTokens: []
      };
    }

    logger.info(`📋 Valid Expo tokens: ${validTokens.length}/${tokens.length}`);

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

    logger.info(`📦 Preparing to send ${messages.length} Expo notifications`);

    // Diviser en chunks (Expo recommande max 100 par requête)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    logger.info(`🔀 Split into ${chunks.length} chunk(s)`);

    // Envoyer chaque chunk
    for (const chunk of chunks) {
      try {
        logger.info(`  → Sending chunk of ${chunk.length} notifications to Expo...`);
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        logger.info(`  ✅ Sent chunk successfully, received ${ticketChunk.length} tickets`);
      } catch (error) {
        logger.error('  ❌ Error sending notification chunk:', error);
      }
    }

    // Analyser les résultats
    const results = {
      success: true,
      sent: 0,
      errors: 0,
      invalidTokens: []
    };

    logger.info(`\n📊 Analyzing ${tickets.length} Expo ticket(s)...`);

    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error') {
        results.errors++;
        logger.error(`  ❌ Notification error for token ${validTokens[index]}:`, {
          message: ticket.message,
          details: ticket.details
        });

        // Si le token est invalide, le marquer pour suppression
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          results.invalidTokens.push(validTokens[index]);
        }
      } else {
        results.sent++;
        logger.info(`  ✅ Ticket ${index + 1}: ${ticket.status} (id: ${ticket.id})`);
      }
    });

    logger.info(`✅ Expo notification sending complete`, {
      sent: results.sent,
      errors: results.errors,
      invalidTokens: results.invalidTokens.length
    });

    return results;

  } catch (error) {
    logger.error('Error in sendExpoNotifications:', error);
    return {
      success: false,
      message: error.message,
      sent: 0,
      errors: 1,
      invalidTokens: []
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

  logger.info(`🚢 sendShipDetectedNotification:`, {
    shipName: ship.name,
    trackId: ship.trackId,
    distanceKm,
    tokensCount: tokens.length
  });

  const data = {
    type: 'ship_detected',
    ship: {
      trackId: ship.trackId,
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
