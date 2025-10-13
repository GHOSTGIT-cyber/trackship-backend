/**
 * Configuration PM2 pour TrackShip Backend
 *
 * Démarrage :
 * pm2 start ecosystem.config.js
 *
 * Commandes utiles :
 * pm2 logs trackship-backend  - Voir les logs
 * pm2 restart trackship-backend  - Redémarrer l'app
 * pm2 stop trackship-backend  - Arrêter l'app
 * pm2 delete trackship-backend  - Supprimer l'app de PM2
 * pm2 monit  - Monitoring en temps réel
 */

module.exports = {
  apps: [{
    name: 'trackship-backend',
    script: './server.js',

    // Mode cluster pour performance (utiliser 'fork' si problème)
    instances: 1,
    exec_mode: 'fork',

    // Variables d'environnement
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Redémarrage automatique
    autorestart: true,
    watch: false, // Ne pas surveiller les fichiers en prod
    max_memory_restart: '500M', // Redémarrer si > 500MB RAM

    // Gestion des erreurs
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,

    // Logs
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Rotation des logs (nécessite pm2-logrotate)
    // Installation : pm2 install pm2-logrotate
    log_type: 'json',

    // Arrêt propre
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,

    // Monitoring avancé (optionnel - nécessite compte PM2.io)
    // pmx: true,
    // instance_var: 'INSTANCE_ID'
  }]
};
