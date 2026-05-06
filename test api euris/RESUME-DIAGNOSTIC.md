# Résumé Diagnostic — TrackShip / API navires Seine

## Contexte
App Node.js (`trackship-backend`) qui surveille des navires sur la Seine via `services/eurisApi.js`.

---

## 1. API EuRIS — RÉSULTAT : NE COUVRE PAS LA SEINE

- **URL** : `https://www.eurisportal.eu/visuris/api/TracksV2/GetTracksByBBoxV2`
- **Params** : `minLon, minLat, maxLon, maxLat, pageSize, skip`
- **Auth** : `Authorization: Bearer <JWT>` — token dans `.env` (exp mars 2027)
- **Format réponse** : tableau JSON direct `[{trackID, name, mmsi, eni, lat, lon, sog, cog, moving, inlen, inbm, posTS}]`
- **Swagger** : `https://www.eurisportal.eu/swagger/docs/Tracks_v2/`
- **Couverture** : Rhin/Belgique/Pays-Bas/Allemagne UNIQUEMENT — **zone France/Seine = 0 navires**
- **Code `services/eurisApi.js`** : correct (URL, params, mapping OK), EuRIS ne diffuse pas les données françaises

---

## 2. Appli VNF Android — INVESTIGATION TERMINÉE (dead end)

- **Package** : `fr.vnf.sifmobile` v2.3.0, Capacitor/Angular, Chromium WebView
- **Téléphone** : Xiaomi 25062RN2DE, ADB connecté, NON rooté
- **Obstacles rencontrés** :
  - Certificate pinning → HTTP Toolkit bloqué (`net_error -202`)
  - `chrome://inspect` → rien (Capacitor désactive le debug WebView)
  - Frida/objection → `aapt` manquant, Android SDK non installé

### Reverse engineering APK (méthode alternative — succès)
APK extrait via ADB : `adb pull /data/app/.../base.apk vnf-sif.apk` (24 MB)

**API découverte dans le bundle webpack** (`main.78671aab2b1339e2.js`, module 27615) :
- **Base URL** : `https://api.vnf.fr/ws/sif360`
- **Auth** : `Authorization: Basic U0lGMzYwOjNlUGM0N2prM01ZVA==` (= `SIF360:3ePc47jk3MYT`)
- **Intercepteur Angular** : ajoute Basic auth + `Accept-Language` + `Version: 2.3.0` — **pas de token utilisateur**
- **Gateway** : Kong 3.2.1 enterprise (derrière `api.vnf.fr`)

**Format POST /map (format exact trouvé dans le JS)** :
```json
{
  "bounding_box": {"west": 2.1, "south": 48.75, "east": 2.5, "north": 48.95},
  "filters": {
    "boats": {"visible": true, "show_name": true},
    "naviUsers": {"visible": true},
    "terminals": {"visible": true, "show_name": true, "provisioning": false},
    "moorings": {"visible": true, "show_name": true},
    "locks": {"visible": true, "show_name": true},
    "gauges": {"visible": true},
    "bridges": {"visible": true},
    "skipper_notices": {"visible": true},
    "flood_restrictions": {"visible": true}
  },
  "zoom": 12
}
```
**Note clé** : le champ bounding_box utilise `{west, south, east, north}` et NON `{min_lat, max_lat, min_lng, max_lng}`

**Résultats des tests** :
- `POST /map` Seine → **30 avis nautiques** (ANNOUNCEMENT/WARNING/INFORMATION/RESTRICTION) ✅
- `POST /map` toute la France → **0 bateaux/naviUsers** ❌
- `GET /home?basin_id=DTBS` → données du bassin Seine (écluses, etc.) ✅
- `POST /api/authenticate` → redirect 302 vers `www.vnf.fr/erreur_404/` (endpoint inexistant)

**Conclusion définitive** :
- Les `naviUsers` = agents VNF qui partagent **volontairement** leur GPS via l'app mobile
- Ce sont des skippers VNF internes, **pas du trafic commercial AIS**
- La méthode filter `createNaviUsersAndBoatsInstance()` met `visible: true` pour les deux
- Mais il n'y a physiquement aucun agent avec l'app ouverte → 0 résultats
- **Cette API ne peut pas servir à tracker les navires commerciaux sur la Seine**

---

## 3. État des fichiers

| Fichier | État |
|---------|------|
| `services/eurisApi.js` | OK — code correct, EuRIS ne couvre pas la Seine |
| `services/aishubApi.js` | Créé — même interface que `eurisApi.js`, prêt à utiliser |
| `.env` | Token EuRIS mis à jour (exp 2027), `AISHUB_USERNAME=` ajouté (vide) |

---

## 4. Prochaine étape — Trouver une API AIS Seine équivalente à EuRIS

**Objectif** : API gratuite, requête par bounding box, retourne positions navires Seine.

EuRIS est le portail européen RIS (River Information Services) — il centralise les données de Rhin/Danube. La France/VNF n'y diffuse pas les données Seine. Il faut trouver l'équivalent national français.

**Pistes à explorer** :
- Portail open data français couvrant les voies navigables (data.gouv.fr ?)
- API directe VNF avec données AIS (différente de SIF360)
- Système RIS français national (SIFLUVE ou équivalent)
- Autre agrégateur AIS mondial gratuit sans inscription

---

## 5. Référence — Format cible `fetchShips(lat, lon, radius)`

Interface attendue (même que `eurisApi.js`) :
```js
{
  trackId, mmsi, name, latitude, longitude,
  speed, course, moving, length, width, timestamp
}
```
