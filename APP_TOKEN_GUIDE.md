# 📱 Guide : Génération de Tokens Push pour TrackShip

Ce guide explique comment générer le bon type de token push dans votre application mobile React Native / Expo.

## 🎯 Les deux types de tokens

### 1. Token Expo (pour Expo Go)
- **Format** : `ExponentPushToken[xxxxxx]`
- **Utilisation** : Développement avec Expo Go
- **Serveur** : Utilise les serveurs Expo
- **Configuration** : Aucune (fonctionne out-of-the-box)

### 2. Token FCM Natif (pour APK/IPA)
- **Format** : Chaîne alphanumérique longue (100+ caractères)
- **Utilisation** : APK Android / IPA iOS compilées
- **Serveur** : Utilise Firebase Cloud Messaging directement
- **Configuration** : Nécessite `google-services.json` (Android) ou `GoogleService-Info.plist` (iOS)

---

## 🔧 Configuration dans votre App

### Option 1 : Expo Go (Développement)

```javascript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  try {
    // Demander la permission
    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== 'granted') {
      alert('Permission notifications refusée');
      return;
    }

    // Obtenir le token Expo
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Token Expo:', token); // ExponentPushToken[...]

    // Enregistrer sur le backend
    await registerTokenOnBackend(token);

  } catch (error) {
    console.error('Erreur token Expo:', error);
  }
}

async function registerTokenOnBackend(token) {
  const response = await fetch('https://votre-backend.railway.app/register-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });

  const result = await response.json();
  console.log('Token enregistré:', result);
}
```

**Avantages** :
- ✅ Aucune configuration Firebase nécessaire
- ✅ Fonctionne immédiatement
- ✅ Parfait pour le développement

**Limitations** :
- ❌ Ne fonctionne qu'avec Expo Go
- ❌ APK natives ne reçoivent pas les notifications

---

### Option 2 : APK/IPA Native (Production)

#### Étape 1 : Configuration Firebase

1. **Créer un projet Firebase** :
   - Aller sur [Firebase Console](https://console.firebase.google.com/)
   - Créer un nouveau projet ou utiliser un existant

2. **Ajouter votre app Android** :
   - Dans Firebase Console > Project Settings > Your apps
   - Cliquer sur "Add app" > Android
   - Package name : doit correspondre à votre `app.json` (`android.package`)
   - Télécharger `google-services.json`

3. **Placer le fichier** :
   ```
   votre-projet/
   ├── app.json
   ├── google-services.json  ← Placer ici (racine du projet)
   └── ...
   ```

4. **Configurer app.json** :
   ```json
   {
     "expo": {
       "android": {
         "package": "com.votresociete.trackship",
         "googleServicesFile": "./google-services.json"
       },
       "plugins": [
         [
           "expo-notifications",
           {
             "icon": "./assets/icon.png",
             "color": "#ffffff"
           }
        ]
       ]
     }
   }
   ```

#### Étape 2 : Code de l'app

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

async function registerForPushNotificationsNative() {
  try {
    // Vérifier que c'est un device physique
    if (!Device.isDevice) {
      alert('Les notifications push ne fonctionnent que sur un device physique');
      return;
    }

    // Demander la permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Permission notifications refusée');
      return;
    }

    // IMPORTANT : Utiliser getDevicePushTokenAsync pour APK natives
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;

    console.log('Token FCM natif:', token);
    console.log('Longueur:', token.length); // Devrait être 100+ caractères
    console.log('Type:', tokenData.type); // Devrait être "android" ou "ios"

    // Enregistrer sur le backend
    await registerTokenOnBackend(token);

  } catch (error) {
    console.error('Erreur token natif:', error);
  }
}

async function registerTokenOnBackend(token) {
  try {
    const response = await fetch('https://votre-backend.railway.app/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Token enregistré:', result.tokenType);
      alert(`Token ${result.tokenType} enregistré avec succès !`);
    } else {
      console.error('❌ Erreur:', result.error);
      alert(`Erreur: ${result.error}\n${result.hint || ''}`);
    }

  } catch (error) {
    console.error('Erreur réseau:', error);
    alert('Erreur de connexion au backend');
  }
}
```

#### Étape 3 : Compiler l'APK

```bash
# Installer EAS CLI si pas déjà fait
npm install -g eas-cli

# Login
eas login

# Configurer le projet
eas build:configure

# Compiler l'APK
eas build --platform android --profile production

# OU pour un build local
eas build --platform android --profile production --local
```

**Avantages** :
- ✅ Fonctionne sur APK compilées
- ✅ Notifications fiables en production
- ✅ Support Android et iOS

**Configuration requise** :
- ⚙️ Firebase configuré
- ⚙️ `google-services.json` ajouté
- ⚙️ Backend avec credentials Firebase

---

## 🔍 Détection du bon Token à utiliser

Voici un helper pour choisir automatiquement :

```javascript
import Constants from 'expo-constants';

async function registerPushToken() {
  try {
    // Vérifier si on est dans Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';

    if (isExpoGo) {
      console.log('📱 Expo Go détecté → Token Expo');
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await registerTokenOnBackend(token);
    } else {
      console.log('📦 APK native détectée → Token FCM');
      const tokenData = await Notifications.getDevicePushTokenAsync();
      await registerTokenOnBackend(tokenData.data);
    }

  } catch (error) {
    console.error('Erreur enregistrement token:', error);
  }
}
```

---

## 🐛 Debugging

### Problème : "InvalidCredentials" avec token Expo

**Erreur backend** :
```
[EXPO] ❌ Erreur InvalidCredentials pour token ExponentPushToken[...]
[EXPO] 💡 Ce token Expo nécessite la configuration FCM Server Key dans Expo
```

**Solutions** :
1. **Option A** : Configurez FCM dans Expo (voir ci-dessus)
2. **Option B** : Utilisez `getDevicePushTokenAsync()` pour un token FCM natif
3. **Option C** : Testez avec Expo Go (fonctionne sans config)

---

### Problème : "Token FCM invalide"

**Erreur backend** :
```
[FCM] ❌ Token FCM invalide: 446b2ae0ba46364671d5324c4a08ff...
[FCM] 💡 Token trop court (48 caractères). Les tokens FCM font généralement 100+ caractères.
```

**Solutions** :
1. Vérifiez que vous utilisez `getDevicePushTokenAsync()` et pas `getExpoPushTokenAsync()`
2. Vérifiez que `google-services.json` est bien configuré
3. Compilez une nouvelle APK avec `eas build`

---

### Problème : Token change à chaque redémarrage

**Normal !** Les tokens peuvent changer :
- Après une réinstallation de l'app
- Après un clear des données
- Parfois après une mise à jour

**Solution** : Enregistrez le token à chaque démarrage de l'app (dans `useEffect` ou `App.tsx`)

---

## 📊 Vérifier le type de token

### Token Expo valide
```
ExponentPushToken[xxxxxxxxxxxxxx]
```
- Commence par `ExponentPushToken[`
- Se termine par `]`
- Longueur : 50-100 caractères

### Token FCM valide
```
c9Xj7YzKQrGm4... (très long)
```
- Alphanumériques + `:`, `-`, `_`
- Pas de `[` ou `]`
- Longueur : 100-200 caractères

---

## ✅ Checklist

### Pour Expo Go (Dev)
- [ ] `getExpoPushTokenAsync()` utilisé
- [ ] Permission notifications demandée
- [ ] Token enregistré sur le backend
- [ ] Backend retourne `tokenType: "Expo"`

### Pour APK Native (Prod)
- [ ] Projet Firebase créé
- [ ] `google-services.json` téléchargé
- [ ] Fichier placé à la racine du projet
- [ ] `app.json` configuré avec `googleServicesFile`
- [ ] `getDevicePushTokenAsync()` utilisé
- [ ] APK compilée avec `eas build`
- [ ] Backend configuré avec credentials Firebase
- [ ] Token enregistré sur le backend
- [ ] Backend retourne `tokenType: "FCM Native"`

---

## 🆘 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs backend** : Le backend affiche des messages clairs avec `[EXPO]` ou `[FCM]`
2. **Vérifier le type de token** : `console.log(token.length, token.substring(0, 30))`
3. **Tester l'enregistrement** : Utilisez l'endpoint `/register-token` et vérifiez la réponse
4. **Logs détaillés** : Activer `LOG_LEVEL=debug` dans le backend

---

## 📚 Ressources

- [Expo Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Backend TrackShip : FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
