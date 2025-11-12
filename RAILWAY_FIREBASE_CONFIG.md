# Configuration Firebase sur Railway

## 📋 Variables d'environnement à ajouter

Depuis votre fichier Firebase `trackship-63457-firebase-adminsdk-fbsvc-7eb1654ea9.json`, extraire :

### 1. FIREBASE_PROJECT_ID
```
trackship-63457
```

### 2. FIREBASE_CLIENT_EMAIL
```
firebase-adminsdk-fbsvc@trackship-63457.iam.gserviceaccount.com
```

### 3. FIREBASE_PRIVATE_KEY

**IMPORTANT** : La clé privée doit contenir les `\n` littéraux (pas de vrais retours à la ligne).

```
-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCk31IiXP1m9jLP\njNIucND3Zy1QeHYkctnL+Ax+LcnjdsMdrGCXKzVu5M5PEUJRBXIklHBUE8HMwC2L\nwfXmePjZGeh/LM2NyZpcq1bLebDcsbO5DAsPjMKshSw7ymduMhwIdKeYfz3eNTvq\nqtY/R1G3b8myqf9KP724LlDuau/Mds77Rd1h9q7Qr2UaTFCkgnJke2yh79oXw8YF\notT9gWqPj2X8eeov4baL5aPOjBMdfoXcAyz9K6fmeQ8tDk4Ujyctsu9SDZwm9ctC\ndCOnNGeEu2XvUzQFkFOIKj9nhsUg7BRpAhVQwKq7NothFkmgOUEJfo9MZSb8Kmfj\nZR00sgE/AgMBAAECggEAC5vHWX2l2e07zQeweAfTFTH0+G8cfAFNYUjCmGyUHamF\nbQsJQgH1oSxuQK+8ztEzWDmbYlAbaFWfrCRCZbF4bZ2e+rvACih6736g5D+NOsmV\nF4WUwcnt0XfbxXOOFMdlpRkrM75bYza17hZZP3Ty3zEslaFvXpFeXYZLuUqOPjcb\nwAGQlTqOcGnH8zdm+mQEYk8ObuI7oB7Y1So7DuY57waf4jE7Mr9TLX3zCukaIBlR\njYuBjDO2n2Y50THHc9qpk0o6hfqOCEtvfc+gBESzZaB7L21Lh2eUrnNujieocyDo\n/fBa45sVUczbX+cu7MqKJQmt32MzhXA+4jeUABJMAQKBgQDo4XoMcwzD/D3SOjjQ\nFCMZFDzXl7fVeFSx8K/UkmyIFCsGlYkL4oRiYhG4WBWYEh1Zif/TqKLWsEdhzCKh\nqqr4O49PMbzSejTvL8Q1JFBOSCWkceKrtrsVM6132CIO/Vas8ybVpw7eIzVkFbdy\nEshC6P94e51to9K56a2d1sjXzwKBgQC1PXOM6r7AUuwjjWHwIbFvr74vmzmQveu9\nwbHV1j06EY1xYE91sXDiL/qXiBMjizBCqeBs9q8B3C7bqFrcY7zp//P9rHYGO37r\nLslC+kkLK9wDW/LD4A77EO415YGjQT6hC1oMfd44LEzC0GCBOrgnKPu7aqPg/OHq\nBZuioFArkQKBgQCKkb/hsIOkCm9urB4qEhFgVt5tGmXUq6kZyDGXtxjFT9raLBhD\n7iD/uYL5wc/3kK/OG4MSGoHqZTHUS3c/4yGgWzBG2z2TsAvXVwDU7iqqqdtcIjfS\nHQTs9Lb/XKfHa48rkfNFpgX+v8yBJTrmsa5fwexhcIyYNKaq4RThmnAfmQKBgDKZ\ngn4wN6tIO2c9nL9HGNu+rBFse+jeLUfgIP87fgKNTfj+U5DfRk3P6V2O/xDoVkP2\nW5LwWDHjwC1RVnS7X83QyNTk5lqdF7Ufbc9GQ0hcKWPCswdesbAErQzdE5F5sLuT\niMN+DKGQNKobNSY/N5SvS4CqqDAzSftlL2t66IcRAoGAXcpLaOQU2ivsvI84lj9n\nILZej7HG9DFx5/LpighYwH0XchWLg0D1LeHUEiHXcA9e3/SpPU/X7zYYsiG8a88N\nV/EfM9FdPzEpKBNTTcUjIxqxj+Aw+1wH6E5yHJ+fFIm4s22fUTmMJY3/2YXtXTve\njQk+SB5x9ULkSDeJYXE9ISI=\n-----END PRIVATE KEY-----\n
```

## 🚀 Étapes dans Railway

1. **Aller sur Railway Dashboard**
   - https://railway.app/dashboard
   - Sélectionner votre projet TrackShip Backend

2. **Aller dans Variables**
   - Cliquer sur l'onglet "Variables" ou "Settings"

3. **Ajouter les 3 variables** :
   - Cliquer sur "New Variable"
   - Copier-coller chaque variable exactement comme ci-dessus
   - **IMPORTANT** : Pour `FIREBASE_PRIVATE_KEY`, ne pas modifier les `\n`

4. **Redéployer**
   - Railway va automatiquement redéployer
   - Vérifier les logs de démarrage

## ✅ Vérification

Dans les logs de Railway, vous devriez voir :
```
✅ Firebase Admin SDK initialized successfully
   Project ID: trackship-63457
   Client Email: firebase-adminsdk-fbsvc@trackship-63457.iam.gserviceaccount.com
```

Si vous voyez :
```
⚠️  Firebase credentials not configured. FCM notifications will not work for native apps.
```

Alors vérifiez que les 3 variables sont bien définies.

## 🔒 Sécurité

- ✅ Les clés privées Firebase sont sécurisées dans Railway (non visibles publiquement)
- ✅ Utiliser les variables d'environnement (jamais commit les credentials)
- ✅ Le fichier JSON local doit être ajouté à `.gitignore`

## 📄 Fichiers à ne JAMAIS commit

Ajoutez dans votre `.gitignore` :
```
# Firebase credentials
*firebase-adminsdk*.json
google-services.json
GoogleService-Info.plist
```
