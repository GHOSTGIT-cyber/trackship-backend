# Déploiement sur Railway.app

Railway.app est une plateforme PaaS (Platform as a Service) gratuite qui permet de déployer facilement des applications Node.js avec SSL automatique et domaines personnalisés.

## Avantages de Railway

- ✅ **Gratuit** : 500 heures d'exécution par mois (suffisant pour ce projet)
- ✅ **SSL automatique** : Pas besoin de configurer Let's Encrypt
- ✅ **Déploiement automatique** : À chaque push Git
- ✅ **Logs en temps réel** : Interface web intuitive
- ✅ **Domaine personnalisé** : Supporté gratuitement
- ✅ **Pas de configuration serveur** : Pas besoin de gérer un VPS

## Prérequis

1. Compte GitHub (gratuit)
2. Compte Railway.app (gratuit) : https://railway.app

## Étapes de déploiement

### 1. Pousser le code sur GitHub

```bash
# Initialiser le dépôt Git (déjà fait)
git remote add origin https://github.com/votre-username/trackship-backend.git
git branch -M main
git push -u origin main
```

### 2. Créer un compte Railway

1. Aller sur https://railway.app
2. Cliquer sur "Start a New Project"
3. Se connecter avec GitHub

### 3. Créer un nouveau projet

1. Cliquer sur "New Project"
2. Sélectionner "Deploy from GitHub repo"
3. Autoriser Railway à accéder à vos repos GitHub
4. Sélectionner le repo `trackship-backend`
5. Railway détecte automatiquement Node.js et commence le déploiement

### 4. Configurer les variables d'environnement

Dans l'interface Railway :

1. Cliquer sur votre projet
2. Aller dans l'onglet "Variables"
3. Ajouter les variables suivantes :

```
BASE_LAT=48.853229
BASE_LON=2.225328
EURIS_API_URL=https://bakabi.fr/trackship/api/euris-proxy.php
NODE_ENV=production
CHECK_INTERVAL=30000
LOG_LEVEL=info
```

**Note** : Pas besoin de définir `PORT`, Railway le fait automatiquement.

### 5. Obtenir l'URL du déploiement

Une fois déployé, Railway vous donne une URL automatique :
- Format : `trackship-backend-production.up.railway.app`

Tester l'API :
```bash
curl https://trackship-backend-production.up.railway.app/
```

Réponse attendue :
```json
{
  "name": "TrackShip Backend API",
  "status": "online",
  "version": "1.0.0"
}
```

### 6. Configurer un domaine personnalisé (optionnel)

Pour utiliser `api.bakabi.fr` :

#### Dans Railway :

1. Aller dans "Settings" → "Domains"
2. Cliquer sur "Custom Domain"
3. Entrer `api.bakabi.fr`
4. Railway vous donne un enregistrement CNAME

#### Chez votre registrar de domaine :

Ajouter un enregistrement DNS :
```
Type: CNAME
Nom: api
Valeur: <valeur-fournie-par-railway>
TTL: Auto ou 3600
```

**Attendre 5-10 minutes** pour la propagation DNS.

Le SSL sera automatiquement activé par Railway.

### 7. Déploiement automatique

Maintenant, à chaque fois que vous pushez du code sur GitHub :

```bash
git add .
git commit -m "Amélioration de l'API"
git push
```

Railway **redéploie automatiquement** votre application !

## Vérification du déploiement

### Test des endpoints

```bash
# Health check
curl https://votre-url.railway.app/health

# Liste des navires
curl "https://votre-url.railway.app/ships?radius=5000"

# Nombre de tokens
curl https://votre-url.railway.app/tokens/count
```

### Voir les logs

Dans l'interface Railway :
1. Cliquer sur votre projet
2. Onglet "Logs"
3. Logs en temps réel

Ou via CLI :
```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Voir les logs
railway logs
```

## Gestion du projet

### Redémarrer l'application

Dans Railway :
- "Settings" → "Restart"

### Arrêter l'application

Dans Railway :
- "Settings" → "Pause"

### Supprimer le projet

Dans Railway :
- "Settings" → "Delete Service"

## Monitoring

### Métriques disponibles

Railway fournit automatiquement :
- CPU usage
- Memory usage
- Network usage
- Request logs

Accessible dans l'onglet "Metrics".

### Alertes

Configurer des alertes dans "Settings" → "Notifications" pour être notifié en cas de :
- Déploiement échoué
- Application crashée
- Limite de ressources atteinte

## Limites du plan gratuit

- **500 heures d'exécution/mois**
  - Pour 1 app : ~16 heures/jour
  - Largement suffisant pour ce projet
- **100 GB de bande passante/mois**
- **1 GB RAM par service**
- **1 GB stockage disque**

Si vous dépassez ces limites, Railway propose des plans payants à partir de $5/mois.

## Troubleshooting

### L'application ne démarre pas

Vérifier les logs dans Railway pour voir l'erreur.

Causes communes :
- Variables d'environnement manquantes
- Erreur de syntaxe dans le code
- Dépendances manquantes dans `package.json`

### L'API ne répond pas

1. Vérifier que l'app est bien "Running" dans Railway
2. Vérifier l'URL (copier depuis Railway)
3. Vérifier les logs

### Le worker ne fonctionne pas

Vérifier dans les logs que le message apparaît :
```
✅ Ship checker worker started
```

Si absent, vérifier les variables d'environnement `BASE_LAT` et `BASE_LON`.

## Migration depuis un autre hébergeur

Si vous migrez depuis Oracle Cloud ou autre :

1. Les tokens Expo sont stockés **en mémoire**
   - Les utilisateurs devront se réenregistrer
   - Alternative : implémenter une base de données (Redis, PostgreSQL)

2. Les logs ne sont pas persistants
   - Utiliser un service externe (LogDNA, Papertrail)

3. Le stockage est éphémère
   - Ne pas stocker de fichiers sur le disque

## Support

- Documentation Railway : https://docs.railway.app
- Discord Railway : https://discord.gg/railway
- GitHub Issues : https://github.com/railwayapp/railway/issues

## Alternative : Déploiement manuel (non recommandé)

Si vous préférez Railway CLI :

```bash
# Installer CLI
npm install -g @railway/cli

# Se connecter
railway login

# Initialiser le projet
railway init

# Déployer
railway up
```

Mais le déploiement automatique via GitHub est **fortement recommandé**.
