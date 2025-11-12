const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

let firebaseInitialized = false;

/**
 * Initialise Firebase Admin SDK avec les credentials depuis les variables d'environnement
 */
function initializeFirebase() {
  if (firebaseInitialized) {
    logger.info('Firebase Admin SDK already initialized');
    return;
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Vérifier que les credentials sont présents
    if (!projectId || !privateKey || !clientEmail) {
      logger.warn('⚠️  Firebase credentials not configured. FCM notifications will not work for native apps.');
      logger.warn('   Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in environment variables.');
      return;
    }

    // Remplacer les \n littéraux par de vrais retours à la ligne dans la clé privée
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Initialiser Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        privateKey: formattedPrivateKey,
        clientEmail: clientEmail
      })
    });

    firebaseInitialized = true;
    logger.info('✅ Firebase Admin SDK initialized successfully');
    logger.info(`   Project ID: ${projectId}`);
    logger.info(`   Client Email: ${clientEmail}`);

  } catch (error) {
    logger.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    logger.error('   FCM notifications will not work for native Android apps');
  }
}

/**
 * Vérifie si Firebase est initialisé et disponible
 * @returns {boolean}
 */
function isFirebaseAvailable() {
  return firebaseInitialized;
}

/**
 * Détecte si un token est un token FCM natif (pas Expo)
 * @param {string} token - Le token à vérifier
 * @returns {boolean}
 */
function isFCMToken(token) {
  // Les tokens Expo commencent par "ExponentPushToken[", "ExpoPushToken[", ou "ExpoToken["
  const expoPatterns = [
    'ExponentPushToken[',
    'ExpoPushToken[',
    'ExpoToken['
  ];

  const isExpoToken = expoPatterns.some(pattern => token.startsWith(pattern));

  // Si ce n'est pas un token Expo, c'est probablement un token FCM natif
  return !isExpoToken;
}

/**
 * Valide qu'un token FCM a un format correct
 * Les tokens FCM sont généralement de longues chaînes alphanumériques
 * avec des caractères spéciaux comme : - _ et ont une longueur minimale
 * @param {string} token - Le token FCM à valider
 * @returns {{valid: boolean, reason?: string}}
 */
function validateFCMToken(token) {
  // Vérifier longueur minimale (tokens FCM font généralement 100+ caractères)
  if (token.length < 50) {
    return {
      valid: false,
      reason: `Token trop court (${token.length} caractères). Les tokens FCM font généralement 100+ caractères.`
    };
  }

  // Vérifier longueur maximale raisonnable
  if (token.length > 500) {
    return {
      valid: false,
      reason: `Token trop long (${token.length} caractères). Longueur maximale : 500 caractères.`
    };
  }

  // Vérifier que le token contient uniquement des caractères valides
  // FCM tokens : alphanumériques + quelques caractères spéciaux (: - _)
  const validFCMPattern = /^[a-zA-Z0-9:_-]+$/;
  if (!validFCMPattern.test(token)) {
    return {
      valid: false,
      reason: 'Token contient des caractères invalides. Format FCM attendu : alphanumériques, ":", "-", "_"'
    };
  }

  // Vérifier que ce n'est pas un format Expo déguisé
  if (token.includes('[') || token.includes(']')) {
    return {
      valid: false,
      reason: 'Token ressemble à un token Expo. Utilisez getDevicePushTokenAsync() pour APK natives.'
    };
  }

  return { valid: true };
}

/**
 * Envoie une notification push via Firebase Cloud Messaging (FCM) natif
 * @param {string} token - Token FCM du device Android/iOS natif
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données additionnelles (optionnel)
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendFCMNotification(token, title, body, data = {}) {
  try {
    if (!firebaseInitialized) {
      logger.error('[FCM] ❌ Firebase not initialized. Cannot send FCM notification.');
      logger.error('[FCM] 💡 Add FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL to environment');
      return {
        success: false,
        error: 'Firebase not initialized',
        token: token.substring(0, 30) + '...'
      };
    }

    // Valider le token FCM avant envoi
    const validation = validateFCMToken(token);
    if (!validation.valid) {
      logger.error(`[FCM] ❌ Invalid FCM token format: ${token.substring(0, 30)}...`);
      logger.error(`[FCM] 💡 ${validation.reason}`);
      return {
        success: false,
        error: validation.reason,
        invalidToken: true,
        token: token.substring(0, 30) + '...'
      };
    }

    logger.info(`[FCM] 📧 Sending notification to: ${token.substring(0, 30)}...`);

    // Construire le message FCM
    const message = {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: {
        // Convertir toutes les données en strings (FCM exige des strings)
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
          return acc;
        }, {})
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      }
    };

    // Envoyer via Firebase Admin SDK
    const response = await admin.messaging().send(message);

    logger.info(`[FCM] ✅ Notification sent successfully. Message ID: ${response}`);

    return {
      success: true,
      messageId: response,
      token: token.substring(0, 30) + '...'
    };

  } catch (error) {
    logger.error(`[FCM] ❌ Notification error for token ${token.substring(0, 30)}...`, {
      code: error.code,
      message: error.message
    });

    // Déterminer si le token est invalide
    const isInvalidToken = error.code === 'messaging/invalid-registration-token' ||
                          error.code === 'messaging/registration-token-not-registered';

    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      invalidToken: isInvalidToken,
      token: token.substring(0, 30) + '...'
    };
  }
}

/**
 * Envoie des notifications FCM à plusieurs tokens
 * @param {string[]} tokens - Array de tokens FCM
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données additionnelles (optionnel)
 * @returns {Promise<object>} - Résultats de l'envoi
 */
async function sendFCMNotifications(tokens, title, body, data = {}) {
  if (!firebaseInitialized) {
    logger.error('[FCM] ❌ Firebase not initialized. Cannot send FCM notifications.');
    logger.error('[FCM] 💡 Add Firebase credentials to environment variables');
    return {
      success: false,
      sent: 0,
      errors: tokens.length,
      invalidTokens: []
    };
  }

  logger.info(`[FCM] 📧 Sending notifications to ${tokens.length} token(s)`);

  const results = {
    success: true,
    sent: 0,
    errors: 0,
    invalidTokens: []
  };

  // Envoyer à chaque token individuellement
  for (const token of tokens) {
    const result = await sendFCMNotification(token, title, body, data);

    if (result.success) {
      results.sent++;
    } else {
      results.errors++;
      if (result.invalidToken) {
        results.invalidTokens.push(token);
      }
    }
  }

  logger.info(`[FCM] ✅ Notifications complete: ${results.sent} sent, ${results.errors} errors`);

  return results;
}

module.exports = {
  initializeFirebase,
  isFirebaseAvailable,
  isFCMToken,
  validateFCMToken,
  sendFCMNotification,
  sendFCMNotifications
};
