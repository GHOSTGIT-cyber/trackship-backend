const axios = require('axios');
const { calculateDistance } = require('../utils/distanceCalculator');
const { logger } = require('../utils/logger');

// Configuration de l'API EuRIS
const EURIS_API_URL = process.env.EURIS_API_URL || 'https://www.eurisportal.eu/visuris/api/TracksV2/GetTracksByBBoxV2';
const EURIS_JWT_TOKEN = process.env.EURIS_JWT_TOKEN;

/**
 * Convertir lat/lon/radius en bounding box pour l'API EuRIS
 * @param {number} lat - Latitude du centre
 * @param {number} lon - Longitude du centre
 * @param {number} radiusMeters - Rayon en mètres
 * @returns {object} - {minLat, maxLat, minLon, maxLon}
 */
function radiusToBBox(lat, lon, radiusMeters) {
  // Approximation : 1 degré de latitude ≈ 111 km
  const latOffset = (radiusMeters / 1000) / 111;

  // Pour la longitude, la distance varie selon la latitude
  // 1 degré de longitude ≈ 111 km * cos(latitude)
  const lonOffset = (radiusMeters / 1000) / (111 * Math.cos(lat * Math.PI / 180));

  return {
    minLat: lat - latOffset,
    maxLat: lat + latOffset,
    minLon: lon - lonOffset,
    maxLon: lon + lonOffset
  };
}

/**
 * Récupérer les navires depuis l'API EuRIS (appel direct, sans proxy PHP)
 * @param {number} lat - Latitude du point de référence
 * @param {number} lon - Longitude du point de référence
 * @param {number} radius - Rayon de recherche en mètres
 * @returns {Promise<Array>} - Liste des navires avec leurs informations et distance
 */
async function fetchShips(lat, lon, radius) {
  try {
    // Vérifier que le token JWT est configuré
    if (!EURIS_JWT_TOKEN) {
      logger.error('❌ EURIS_JWT_TOKEN not configured in environment variables');
      return [];
    }

    // Convertir lat/lon/radius en bounding box
    const bbox = radiusToBBox(lat, lon, radius);

    logger.info(`🌍 Calling EuRIS API directly`, {
      center: { lat, lon },
      radius: `${radius}m`,
      bbox: {
        minLat: bbox.minLat.toFixed(6),
        maxLat: bbox.maxLat.toFixed(6),
        minLon: bbox.minLon.toFixed(6),
        maxLon: bbox.maxLon.toFixed(6)
      },
      url: EURIS_API_URL
    });

    // Appeler l'API EuRIS GetTracksByBBoxV2
    const response = await axios.get(EURIS_API_URL, {
      params: {
        minLat: bbox.minLat,
        maxLat: bbox.maxLat,
        minLon: bbox.minLon,
        maxLon: bbox.maxLon,
        pageSize: 100 // Max autorisé par l'API
      },
      headers: {
        'Authorization': `Bearer ${EURIS_JWT_TOKEN}`,
        'Accept': 'application/json'
      },
      timeout: 15000 // 15 secondes
    });

    // Vérifier la réponse
    if (!response.data) {
      logger.warn('⚠️  Empty response from EuRIS API');
      return [];
    }

    // L'API retourne soit un tableau direct [{...}] (ancien format)
    // soit un objet {items: [...], count: N, nextPageLink: ...} (nouveau format)
    const data = response.data;
    const tracks = Array.isArray(data)
      ? data
      : (data?.items || data?.Items || []);

    logger.info(`✅ EuRIS returned ${tracks.length} tracks (total: ${data?.count ?? tracks.length})`);

    // Calculer la distance pour chaque navire et formater les données
    const shipsWithDistance = tracks.map(track => {
      const distance = calculateDistance(
        lat,
        lon,
        track.lat,
        track.lon
      );

      return {
        // Identifiants
        trackId: track.trackID || `track-${Math.random()}`,
        mmsi: track.mmsi || null,
        eni: track.eni || null,
        imo: track.imo || null,

        // Nom et informations de base
        name: track.name || 'Navire inconnu',
        callSign: track.callSign || null,

        // Position et mouvement
        lat: track.lat,
        lon: track.lon,
        course: track.cog || null, // Course Over Ground
        speed: track.sog || null, // Speed Over Ground (km/h)
        heading: track.cog || null, // Utiliser COG comme heading si pas d'autre info
        moving: track.moving || false,

        // Dimensions
        shipType: track.aismst || track.erist || null,
        length: track.inlen || null, // Longueur en mètres
        width: track.inbm || null, // Largeur en mètres

        // Statut et metadata
        navigationStatus: track.ns || null,
        sailingStatus: track.st || null,
        timestamp: track.posTS || new Date().toISOString(),

        // Position ISRS (système de référence des voies navigables européennes)
        positionISRS: track.positionISRS || null,
        positionISRSName: track.positionISRSName || null,

        // Distance calculée
        distance: distance
      };
    });

    // Filtrer par rayon exact (la bbox est approximative)
    const filteredShips = shipsWithDistance.filter(ship => ship.distance <= radius);

    // Trier par distance (plus proche en premier)
    filteredShips.sort((a, b) => a.distance - b.distance);

    logger.info(`📊 Filtered to ${filteredShips.length} ships within ${radius}m`, {
      total: tracks.length,
      filtered: filteredShips.length,
      ratio: `${((filteredShips.length / tracks.length) * 100).toFixed(1)}%`
    });

    return filteredShips;

  } catch (error) {
    // Gestion des erreurs détaillée
    if (error.code === 'ECONNABORTED') {
      logger.error('❌ EuRIS API request timeout (15s)');
    } else if (error.response) {
      logger.error('❌ EuRIS API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      logger.error('❌ No response from EuRIS API:', {
        message: error.message,
        code: error.code
      });
    } else {
      logger.error('❌ Error calling EuRIS API:', {
        message: error.message,
        stack: error.stack
      });
    }

    // Retourner un array vide en cas d'erreur pour ne pas crasher le worker
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
  // (la conversion en bounding box est approximative)
  const ships = await fetchShips(lat, lon, zoneRadius + 500);

  // Filtrer exactement par le rayon de la zone
  return ships.filter(ship => ship.distance <= zoneRadius);
}

module.exports = {
  fetchShips,
  getShipsInZone
};
