# Configuration Firebase pour TrackShip Backend

Ce guide explique comment configurer Firebase Cloud Messaging (FCM) pour supporter les notifications push natives dans les APK Android compilées.

## 🎯 Pourquoi Firebase ?

- **Expo Go** : Utilise les serveurs Expo (aucune config Firebase nécessaire)
- **APK/IPA natives** : Nécessitent Firebase Cloud Messaging pour recevoir les notifications

Le backend supporte maintenant **les deux** simultanément !

## 📋 Prérequis

1. Un projet Firebase (gratuit)
2. Accès à Firebase Console
3. Accès au dashboard Railway

## 🔧 Étapes de configuration

### 1. Créer/Accéder au projet Firebase

1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer Cloud Messaging (automatiquement activé)

### 2. Obtenir les credentials du Service Account

1. Dans Firebase Console, cliquer sur **⚙️ Settings** > **Project Settings**
2. Aller dans l'onglet **Service Accounts**
3. Cliquer sur **Generate New Private Key**
4. Télécharger le fichier JSON

Le fichier JSON contient toutes les informations nécessaires :
```json
{
  "type": "service_account",
  "project_id": "votre-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@votre-project.iam.gserviceaccount.com",
  ...
}
```

### 3. Configurer les variables d'environnement dans Railway

1. Aller sur le dashboard Railway
2. Sélectionner votre projet TrackShip Backend
3. Aller dans **Variables** (ou **Settings**)
4. Ajouter les 3 variables suivantes :

#### Variable 1 : FIREBASE_PROJECT_ID
```
FIREBASE_PROJECT_ID=votre-project-id
```
- Copier depuis `project_id` dans le JSON

#### Variable 2 : FIREBASE_PRIVATE_KEY
```
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nVOTRE_CLE_ICI\n-----END PRIVATE KEY-----\n
```
- Copier depuis `private_key` dans le JSON
- **Important** : Garder les `\n` littéraux (ne pas les remplacer par de vrais retours à la ligne)
- Mettre entre guillemets si Railway le demande

#### Variable 3 : FIREBASE_CLIENT_EMAIL
```
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@votre-project.iam.gserviceaccount.com
```
- Copier depuis `client_email` dans le JSON

### 4. Redéployer sur Railway

Après avoir ajouté les variables :
1. Railway va automatiquement redéployer
2. Vérifier les logs pour confirmer l'initialisation :
   ```
   ✅ Firebase Admin SDK initialized successfully
      Project ID: votre-project-id
      Client Email: firebase-adminsdk-xxxxx@...
   ```

### 5. Tester avec l'APK Android

1. Compiler votre APK avec `eas build`
2. Installer l'APK sur un device Android
3. Ouvrir l'app et enregistrer le token push
4. Vérifier les logs du backend :
   ```
   📱 Detected FCM native token: ...
   ✅ Token registered successfully: ...
      tokenType: FCM Native
   ```

## ✅ Vérification

### Backend logs attendus au démarrage :
```
✅ Firebase Admin SDK initialized successfully
   Project ID: trackship-xxxxx
   Client Email: firebase-adminsdk-xxxxx@trackship-xxxxx.iam.gserviceaccount.com
```

### Si les credentials ne sont pas configurés :
```
⚠️  Firebase credentials not configured. FCM notifications will not work for native apps.
    Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in environment variables.
```

### Lors de l'enregistrement d'un token APK :
```
✅ Token registered successfully: c...
   tokenType: FCM Native
   totalTokens: 1
```

### Lors de l'envoi de notifications :
```
📋 Token distribution: 0 Expo, 1 FCM native

📤 Sending to 1 FCM native token(s)...
📧 Sending FCM notification to: c...
✅ FCM notification sent successfully. Message ID: projects/...
```

## 🔍 Debugging

### Problème : "Firebase not initialized"
- Vérifier que les 3 variables sont bien définies dans Railway
- Vérifier qu'il n'y a pas d'espaces avant/après les valeurs
- Vérifier les logs de démarrage du backend

### Problème : "Invalid private key"
- Vérifier que `\n` est bien littéral (pas de vrais retours à la ligne)
- Format correct : `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`

### Problème : "Permission denied"
- Vérifier que le Service Account a bien les permissions Cloud Messaging
- Régénérer une nouvelle clé si nécessaire

## 📱 Configuration côté app mobile

Dans votre app React Native / Expo :

```javascript
// app.json ou eas.json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  },
  "ios": {
    "googleServicesFile": "./GoogleService-Info.plist"
  }
}
```

Télécharger `google-services.json` depuis Firebase Console > Project Settings > Your apps > Android

## 🎉 Résultat

Votre backend supporte maintenant :
- ✅ Tokens Expo (Expo Go)
- ✅ Tokens FCM natifs (APK Android)
- ✅ Détection automatique du type
- ✅ Routage intelligent vers le bon service
- ✅ Logs détaillés pour debugging

## 📚 Ressources

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Admin SDK Node.js](https://firebase.google.com/docs/admin/setup)
- [Railway Documentation](https://docs.railway.app/)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
