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
        logger.info(`[FCM] 📱 Token FCM natif détecté : ${token.substring(0, 30)}...`);
        fcmTokens.push(token);
      } else {
        logger.info(`[EXPO] 📱 Token Expo détecté : ${token.substring(0, 30)}...`);
        expoTokens.push(token);
      }
    });

    logger.info(`📋 Distribution: ${expoTokens.length} Expo, ${fcmTokens.length} FCM native`);

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
      logger.info(`\n[EXPO] 📤 Envoi à ${expoTokens.length} token(s) Expo...`);
      const expoResults = await sendExpoNotifications(expoTokens, title, body, data);
      combinedResults.expoResults = expoResults;
      combinedResults.sent += expoResults.sent;
      combinedResults.errors += expoResults.errors;
      combinedResults.invalidTokens.push(...expoResults.invalidTokens);
    }

    // Envoyer aux tokens FCM natifs si présents
    if (fcmTokens.length > 0) {
      logger.info(`\n[FCM] 📤 Envoi à ${fcmTokens.length} token(s) FCM natif...`);
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
        logger.warn(`[EXPO] ❌ Token Expo invalide: ${token}`);
        return false;
      }
      logger.info(`[EXPO] ✅ Token Expo valide: ${token.substring(0, 30)}...`);
      return true;
    });

    if (validTokens.length === 0) {
      logger.warn('[EXPO] ⚠️  Aucun token Expo valide');
      return {
        success: false,
        message: 'No valid tokens',
        sent: 0,
        errors: 0,
        invalidTokens: []
      };
    }

    logger.info(`[EXPO] 📋 Tokens valides: ${validTokens.length}/${tokens.length}`);

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

    logger.info(`[EXPO] 📦 Préparation de ${messages.length} notifications`);

    // Diviser en chunks (Expo recommande max 100 par requête)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    logger.info(`[EXPO] 🔀 Divisé en ${chunks.length} chunk(s)`);

    // Envoyer chaque chunk
    for (const chunk of chunks) {
      try {
        logger.info(`[EXPO]   → Envoi chunk de ${chunk.length} notifications...`);
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        logger.info(`[EXPO]   ✅ Chunk envoyé, ${ticketChunk.length} tickets reçus`);
      } catch (error) {
        logger.error('[EXPO]   ❌ Erreur envoi chunk:', error);
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

        const errorType = ticket.details?.error;
        const tokenPreview = validTokens[index].substring(0, 30) + '...';

        // Gestion spécifique de l'erreur InvalidCredentials
        if (errorType === 'InvalidCredentials') {
          logger.error(`[EXPO] ❌ Erreur InvalidCredentials pour token ${tokenPreview}`);
          logger.error(`[EXPO] 💡 Ce token Expo nécessite la configuration FCM Server Key dans Expo`);
          logger.error(`[EXPO] 💡 Solutions :`);
          logger.error(`[EXPO]    1. Configurez FCM dans votre projet Expo (app.json)`);
          logger.error(`[EXPO]    2. OU utilisez getDevicePushTokenAsync() pour un token FCM natif dans votre APK`);
          logger.error(`[EXPO]    3. OU testez avec Expo Go qui ne nécessite pas FCM`);
        } else {
          logger.error(`[EXPO] ❌ Notification error for token ${tokenPreview}:`, {
            message: ticket.message,
            details: ticket.details
          });
        }

        // Si le token est invalide, le marquer pour suppression
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          results.invalidTokens.push(validTokens[index]);
        }
      } else {
        results.sent++;
        logger.info(`[EXPO] ✅ Ticket ${index + 1}: ${ticket.status} (id: ${ticket.id})`);
      }
    });

    logger.info(`[EXPO] ✅ Envoi terminé`, {
      sent: results.sent,
      errors: results.errors,
      invalidTokens: results.invalidTokens.length
    });

    return results;

  } catch (error) {
    logger.error('[EXPO] ❌ Erreur dans sendExpoNotifications:', error);
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
