const axios = require('axios');
const { calculateDistance } = require('../utils/distanceCalculator');
const { logger } = require('../utils/logger');

/**
 * Récupérer les navires depuis l'API EuRIS via le proxy PHP
 * @param {number} lat - Latitude du point de référence
 * @param {number} lon - Longitude du point de référence
 * @param {number} radius - Rayon de recherche en mètres
 * @returns {Promise<Array>} - Liste des navires avec leurs informations et distance
 */
async function fetchShips(lat, lon, radius) {
  try {
    const apiUrl = process.env.EURIS_API_URL || 'https://bakabi.fr/trackship/api/euris-proxy.php';

    logger.info(`Fetching ships from EuRIS`, {
      lat,
      lon,
      radius,
      apiUrl
    });

    // Appeler le proxy PHP
    const response = await axios.get(apiUrl, {
      params: {
        lat: lat,
        lon: lon,
        radius: radius
      },
      timeout: 10000 // 10 secondes timeout
    });

    // Vérifier la réponse
    if (!response.data) {
      logger.warn('Empty response from EuRIS API');
      return [];
    }

    // Parser les données (le format dépend de la réponse du proxy)
    let ships = [];

    // Si c'est un objet avec une propriété ships
    if (response.data.ships && Array.isArray(response.data.ships)) {
      ships = response.data.ships;
    }
    // Si c'est directement un array
    else if (Array.isArray(response.data)) {
      ships = response.data;
    }
    // Si c'est un objet avec features (GeoJSON)
    else if (response.data.features && Array.isArray(response.data.features)) {
      ships = response.data.features.map(feature => ({
        ...feature.properties,
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }));
    }

    // Calculer la distance pour chaque navire
    const shipsWithDistance = ships.map(ship => {
      const distance = calculateDistance(
        lat,
        lon,
        ship.lat || ship.latitude,
        ship.lon || ship.longitude
      );

      return {
        mmsi: ship.mmsi || ship.MMSI,
        name: ship.name || ship.shipname || ship.SHIPNAME || 'Unknown',
        lat: ship.lat || ship.latitude,
        lon: ship.lon || ship.longitude,
        course: ship.course || ship.COG || null,
        speed: ship.speed || ship.SOG || null,
        heading: ship.heading || ship.HEADING || null,
        shipType: ship.shipType || ship.ship_type || ship.SHIP_TYPE || null,
        length: ship.length || ship.A || null,
        width: ship.width || ship.B || null,
        timestamp: ship.timestamp || ship.time || new Date().toISOString(),
        distance: distance
      };
    });

    // Filtrer par rayon si nécessaire
    const filteredShips = shipsWithDistance.filter(ship => ship.distance <= radius);

    // Trier par distance
    filteredShips.sort((a, b) => a.distance - b.distance);

    logger.info(`Ships fetched successfully`, {
      total: ships.length,
      filtered: filteredShips.length,
      withinRadius: filteredShips.length
    });

    return filteredShips;

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.error('EuRIS API request timeout');
    } else if (error.response) {
      logger.error('EuRIS API error response:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      logger.error('No response from EuRIS API:', error.message);
    } else {
      logger.error('Error fetching ships:', error.message);
    }

    // Retourner un array vide en cas d'erreur pour ne pas crasher
    return [];
  }
}

/**
 * Obtenir les navires dans une zone spécifique (zone1, zone2, zone3)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoneRadius - Rayon de la zone en mètres
 * @returns {Promise<Array>} - Navires dans la zone
 */
async function getShipsInZone(lat, lon, zoneRadius) {
  // Appeler avec un rayon un peu plus large pour être sûr d'avoir tous les navires
  const ships = await fetchShips(lat, lon, zoneRadius + 500);

  // Filtrer exactement par le rayon de la zone
  return ships.filter(ship => ship.distance <= zoneRadius);
}

module.exports = {
  fetchShips,
  getShipsInZone
};
