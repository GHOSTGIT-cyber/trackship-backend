# Instructions de test - TrackShip Backend API

URL de production : **https://api.bakabi.fr**

## Méthode 1 : Script Node.js (recommandé)

Le moyen le plus simple pour tester toutes les routes :

```bash
node test-api.js
```

Ce script teste automatiquement :
- ✅ GET / (root endpoint)
- ✅ GET /health
- ✅ GET /ships (navires avec zones)
- ✅ POST /register-token
- ✅ GET /tokens/count

---

## Méthode 2 : PowerShell / CMD Windows

### Test 1 : Root endpoint

```powershell
curl.exe -X GET https://api.bakabi.fr/
```

**Réponse attendue :**
```json
{
  "name": "TrackShip Backend API",
  "status": "online",
  "version": "1.0.0"
}
```

---

### Test 2 : Health check

```powershell
curl.exe -X GET https://api.bakabi.fr/health
```

**Réponse attendue :**
```json
{
  "status": "ok",
  "timestamp": "2025-10-14T...",
  "uptime": 12345,
  "registeredTokens": 0
}
```

---

### Test 3 : Navires dans les zones

```powershell
curl.exe -X GET https://api.bakabi.fr/ships
```

**Réponse attendue :**
```json
{
  "success": true,
  "total": 15,
  "zones": {
    "zone1km": 0,
    "zone2km": 2,
    "zone3km": 5,
    "beyond3km": 8
  },
  "ships": [
    {
      "trackId": "123456",
      "name": "EXAMPLE SHIP",
      "distance": 2456,
      "distanceKm": "2.46",
      "moving": true,
      "course": 180,
      "speed": "12.5",
      "heading": 175,
      "lat": 48.853229,
      "lon": 2.225328
    }
  ]
}
```

**Explication des zones :**
- `zone1km` : Navires à moins de 1km (très proche)
- `zone2km` : Navires entre 1km et 2km
- `zone3km` : Navires entre 2km et 3km ⚠️ **ZONE DE NOTIFICATION**
- `beyond3km` : Navires au-delà de 3km (pas de notification)

---

### Test 4 : Enregistrer un token Expo (simulation)

```powershell
curl.exe -X POST https://api.bakabi.fr/register-token -H "Content-Type: application/json" -d "{\"token\":\"ExponentPushToken[TEST-123]\"}"
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Token registered successfully",
  "totalTokens": 1
}
```

**Note :** Un token de test ne recevra PAS vraiment de notifications Expo (token invalide). Pour recevoir de vraies notifications, il faut utiliser un vrai token depuis l'app mobile.

---

### Test 5 : Compter les tokens enregistrés

```powershell
curl.exe -X GET https://api.bakabi.fr/tokens/count
```

**Réponse attendue :**
```json
{
  "count": 1,
  "tokens": ["ExponentPushToken[T..."]
}
```

---

### Test 6 : Désenregistrer un token

```powershell
curl.exe -X POST https://api.bakabi.fr/unregister-token -H "Content-Type: application/json" -d "{\"token\":\"ExponentPushToken[TEST-123]\"}"
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Token unregistered successfully",
  "totalTokens": 0
}
```

---

## 🎬 Routes de DÉMO (nouveau)

### Test 7 : Info démo

```powershell
curl.exe -X GET https://api.bakabi.fr/demo/info
```

**Réponse attendue :**
```json
{
  "title": "Route de démo TrackShip",
  "description": "Simule un navire dans la zone rouge (< 1km) et envoie une notification push",
  "registeredTokens": 1,
  "features": [
    "Navire fictif : Foil'in Paris Demo (110m)",
    "Distance : 850m (zone rouge)",
    "Vitesse : 12.5 km/h",
    "Notification push envoyée à tous les appareils enregistrés"
  ]
}
```

---

### Test 8 : Démo notification navire

⚠️ **Important** : Cette route nécessite au moins 1 token enregistré.

```powershell
curl.exe -X POST https://api.bakabi.fr/demo/ship-alert
```

**Réponse attendue (avec token enregistré) :**
```json
{
  "success": true,
  "message": "Notification de démo envoyée avec succès",
  "recipients": 1,
  "notificationResult": {
    "sent": 1,
    "errors": 0
  },
  "ship": {
    "name": "Foil'in Paris Demo",
    "distance": "850m",
    "zone": "ROUGE (< 1km)",
    "speed": "12.5 km/h",
    "length": "110m"
  },
  "info": "Le navire apparaîtra dans l'app pendant quelques secondes"
}
```

**Réponse (sans token) :**
```json
{
  "error": "Aucun appareil enregistré pour les notifications",
  "info": "Installez l'app et activez les notifications d'abord"
}
```

**Cas d'usage :**
- ✅ Tester les notifications push à tout moment (jour/nuit)
- ✅ Démonstration sans attendre un vrai navire
- ✅ Vérifier que l'app reçoit bien les notifications
- ✅ Route ISOLÉE : n'affecte PAS le worker automatique

**Logs Railway attendus :**
```
[INFO] POST /demo/ship-alert
[INFO] 🎬 DÉMO : Notification envoyée à 1 appareil(s) { ship: 'Foil\'in Paris Demo', distance: 850, recipients: 1 }
```

---

## Méthode 3 : Postman / Insomnia

### Importer la collection

1. Créer une nouvelle requête GET : `https://api.bakabi.fr/health`
2. Créer une requête POST : `https://api.bakabi.fr/register-token`
   - Headers : `Content-Type: application/json`
   - Body (JSON) :
     ```json
     {
       "token": "ExponentPushToken[VOTRE-TOKEN]"
     }
     ```

---

## Vérification du Worker (notifications automatiques)

Le worker vérifie les navires **toutes les 30 secondes**.

### Logs Railway

1. Aller sur https://railway.app
2. Ouvrir le projet `trackship-backend`
3. Onglet "Logs"
4. Chercher :
   ```
   Starting ship check cycle
   Found X ships in zone 3km
   🚢 Nouveau navire détecté: ...
   Ship check cycle completed
   ```

### Comportement attendu

Le worker :
- ✅ S'exécute toutes les 30 secondes
- ✅ Récupère les navires via EuRIS API
- ✅ Filtre les navires dans zone 3km
- ✅ Détecte les NOUVEAUX navires (via trackId)
- ✅ Envoie une notification Expo pour chaque nouveau navire
- ✅ Garde en mémoire les navires connus (5 min après sortie de zone)

**Exemple de log complet :**
```
[INFO] Starting ship check cycle
[INFO] Fetching ships from EuRIS { lat: 48.853229, lon: 2.225328, radius: 3000 }
[INFO] Ships fetched successfully { total: 15, filtered: 5 }
[INFO] Found 5 ships in zone 3km
[INFO] 🚢 Nouveau navire détecté: BATEAU TEST (trackId: 123456) à 2.5km
[INFO] Sending notifications for 1 new ship(s)
[INFO] Ship check cycle completed { totalShips: 5, newShips: 1, knownShips: 1, removedShips: 0 }
```

---

## Dépannage

### Erreur CORS

Si vous testez depuis un navigateur et voyez une erreur CORS, c'est normal. Utilisez :
- PowerShell / curl
- Postman
- Le script Node.js `test-api.js`

### Timeout

Si les requêtes prennent trop de temps (>10s), c'est probablement l'API EuRIS qui est lente. Vérifier les logs Railway.

### Aucun navire détecté

Si `GET /ships` retourne `total: 0` :
1. Vérifier que l'API EuRIS fonctionne : https://bakabi.fr/trackship/api/euris-proxy.php
2. Vérifier les coordonnées de base dans Railway (BASE_LAT, BASE_LON)
3. Augmenter le rayon de recherche (modifier RADIUS_KM dans server.js)

### Worker ne détecte pas de nouveaux navires

Le worker ne notifie que les NOUVEAUX navires :
- Si un navire est déjà dans la Map `knownShips`, pas de notification
- Attendre 5 minutes après qu'un navire sorte de la zone pour le redétecter
- Vérifier les logs Railway pour voir `🚢 Nouveau navire détecté`

---

## Tests de bout en bout

Pour tester le système complet :

1. **Enregistrer un vrai token** depuis l'app mobile trackship-mobile
2. **Vérifier le token** : `curl https://api.bakabi.fr/tokens/count`
3. **Attendre** qu'un navire entre dans la zone 3km (max 30s)
4. **Recevoir notification** sur le téléphone
5. **Vérifier logs** Railway pour confirmation

---

## Variables d'environnement Railway

Vérifier dans Railway → Variables :

```
BASE_LAT=48.853229
BASE_LON=2.225328
EURIS_API_URL=https://bakabi.fr/trackship/api/euris-proxy.php
NODE_ENV=production
LOG_LEVEL=info
CHECK_INTERVAL=30000
```

---

## Support

En cas de problème :
1. Vérifier les logs Railway
2. Tester l'API EuRIS manuellement
3. Vérifier que le worker démarre bien (logs au démarrage)
4. Tester avec `node test-api.js`
