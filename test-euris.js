require('dotenv').config();
const eurisApi = require('./services/eurisApi.js');

async function test() {
  console.log('🧪 Test de l\'API EuRIS avec appel direct...\n');
  console.log('🔑 Token configuré:', process.env.EURIS_JWT_TOKEN ? 'Oui (' + process.env.EURIS_JWT_TOKEN.substring(0, 30) + '...)' : 'Non');
  console.log('🌐 API URL:', process.env.EURIS_API_URL);
  console.log('');

  const lat = 48.853229;
  const lon = 2.225328;
  const radius = 5000;

  console.log('📍 Recherche navires autour de la Tour Eiffel');
  console.log('   Rayon: 5000m\n');

  const ships = await eurisApi.fetchShips(lat, lon, radius);

  console.log('\n📊 Résultats:');
  console.log('   Total navires trouvés:', ships.length);

  if (ships.length > 0) {
    console.log('\n🚢 Premiers navires:');
    ships.slice(0, 3).forEach((ship, i) => {
      console.log(`\n   [${i+1}] ${ship.name}`);
      console.log('       TrackID:', ship.trackId);
      console.log('       MMSI:', ship.mmsi || 'N/A');
      console.log('       Distance:', Math.round(ship.distance), 'm');
      console.log('       Vitesse:', ship.speed, 'km/h');
      console.log('       En mouvement:', ship.moving ? 'Oui' : 'Non');
    });
  }

  console.log('\n✅ Test terminé avec succès!');
}

test().catch(err => {
  console.error('❌ Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});
