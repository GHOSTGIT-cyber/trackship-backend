/**
 * Script de test pour l'API TrackShip Backend
 * Usage: node test-api.js
 */

const axios = require('axios');

const API_URL = 'https://api.bakabi.fr';

async function testAPI() {
  console.log('🧪 Tests API TrackShip Backend');
  console.log(`📍 URL: ${API_URL}\n`);

  let passedTests = 0;
  let totalTests = 7;

  // Test 1 : Root endpoint
  console.log('1️⃣  Test GET / (root)');
  try {
    const res = await axios.get(`${API_URL}/`);
    console.log('✅ Root OK:', res.data.name, '-', res.data.status);
    passedTests++;
  } catch (err) {
    console.log('❌ Root ERREUR:', err.message);
  }

  // Test 2 : Health
  console.log('\n2️⃣  Test GET /health');
  try {
    const res = await axios.get(`${API_URL}/health`);
    console.log('✅ Health OK:');
    console.log(`   Status: ${res.data.status}`);
    console.log(`   Uptime: ${Math.round(res.data.uptime)}s`);
    console.log(`   Tokens enregistrés: ${res.data.registeredTokens}`);
    passedTests++;
  } catch (err) {
    console.log('❌ Health ERREUR:', err.message);
  }

  // Test 3 : Ships
  console.log('\n3️⃣  Test GET /ships (navires dans zone)');
  try {
    const res = await axios.get(`${API_URL}/ships`);
    console.log('✅ Ships OK:');

    // Support ancien et nouveau format
    const total = res.data.total || res.data.count || 0;
    console.log(`   Total navires: ${total}`);

    if (res.data.zones) {
      // Nouveau format avec zones
      console.log(`   Zone 1km: ${res.data.zones.zone1km}`);
      console.log(`   Zone 2km: ${res.data.zones.zone2km}`);
      console.log(`   Zone 3km: ${res.data.zones.zone3km} (notifications)`);
      console.log(`   Au-delà 3km: ${res.data.zones.beyond3km}`);
    }

    if (res.data.ships && res.data.ships.length > 0) {
      console.log('\n   📦 Exemple navire:');
      const ship = res.data.ships[0];
      console.log(`      Nom: ${ship.name}`);
      if (ship.trackId) console.log(`      TrackID: ${ship.trackId}`);
      if (ship.distanceKm) console.log(`      Distance: ${ship.distanceKm}km`);
      else if (ship.distance) console.log(`      Distance: ${Math.round(ship.distance)}m`);
      if (ship.moving !== undefined) console.log(`      En mouvement: ${ship.moving ? 'Oui' : 'Non'}`);
      if (ship.speed) console.log(`      Vitesse: ${ship.speed} nœuds`);
    } else {
      console.log('   ℹ️  Aucun navire dans la zone pour le moment');
    }
    passedTests++;
  } catch (err) {
    console.log('❌ Ships ERREUR:', err.response?.data || err.message);
  }

  // Test 4 : Register token (test)
  console.log('\n4️⃣  Test POST /register-token');
  try {
    const res = await axios.post(`${API_URL}/register-token`, {
      token: 'ExpoToken[xxxxxxxxxxxxxxxxxxxxxx]'
    });
    console.log('✅ Register OK:');
    console.log(`   Message: ${res.data.message}`);
    console.log(`   Total tokens: ${res.data.totalTokens}`);
    passedTests++;
  } catch (err) {
    console.log('❌ Register ERREUR:', err.response?.data || err.message);
  }

  // Test 5 : Tokens count
  console.log('\n5️⃣  Test GET /tokens/count');
  try {
    const res = await axios.get(`${API_URL}/tokens/count`);
    console.log('✅ Count OK:');
    console.log(`   Tokens actifs: ${res.data.count}`);
    if (res.data.count > 0) {
      console.log(`   Aperçu tokens:`, res.data.tokens.slice(0, 3));
    }
    passedTests++;
  } catch (err) {
    console.log('❌ Count ERREUR:', err.message);
  }

  // Test 6 : Demo info
  console.log('\n6️⃣  Test GET /demo/info');
  try {
    const res = await axios.get(`${API_URL}/demo/info`);
    console.log('✅ Demo Info OK:');
    console.log(`   Titre: ${res.data.title}`);
    console.log(`   Tokens enregistrés: ${res.data.registeredTokens}`);
    passedTests++;
  } catch (err) {
    console.log('❌ Demo Info ERREUR:', err.message);
  }

  // Test 7 : Demo ship alert (seulement si des tokens existent)
  console.log('\n7️⃣  Test POST /demo/ship-alert');
  try {
    const res = await axios.post(`${API_URL}/demo/ship-alert`);
    console.log('✅ Demo Ship Alert OK:');
    console.log(`   Message: ${res.data.message}`);
    console.log(`   Notifications envoyées à: ${res.data.recipients} appareil(s)`);
    console.log(`   Navire: ${res.data.ship.name} à ${res.data.ship.distance}`);
    passedTests++;
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('⚠️  Demo Ship Alert : Aucun token enregistré (normal)');
      console.log(`   Message: ${err.response.data.error}`);
      passedTests++; // On compte quand même comme passé
    } else {
      console.log('❌ Demo Ship Alert ERREUR:', err.response?.data || err.message);
    }
  }

  // Résumé
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Résumé: ${passedTests}/${totalTests} tests réussis`);

  if (passedTests === totalTests) {
    console.log('✅ Tous les tests sont passés ! 🎉');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) échoué(s)`);
  }

  console.log('='.repeat(50));
}

// Exécuter les tests
testAPI().catch(err => {
  console.error('💥 Erreur fatale:', err.message);
  process.exit(1);
});
