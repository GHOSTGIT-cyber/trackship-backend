/**
 * Calculer la distance entre deux points géographiques
 * Utilise la formule Haversine pour calculer la distance orthodromique
 *
 * @param {number} lat1 - Latitude du point 1 (en degrés)
 * @param {number} lon1 - Longitude du point 1 (en degrés)
 * @param {number} lat2 - Latitude du point 2 (en degrés)
 * @param {number} lon2 - Longitude du point 2 (en degrés)
 * @returns {number} Distance en mètres
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Rayon de la Terre en mètres
  const EARTH_RADIUS = 6371000;

  // Convertir les degrés en radians
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLatRad = toRadians(lat2 - lat1);
  const deltaLonRad = toRadians(lon2 - lon1);

  // Formule Haversine
  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance en mètres
  const distance = EARTH_RADIUS * c;

  return Math.round(distance);
}

/**
 * Convertir des degrés en radians
 * @param {number} degrees - Angle en degrés
 * @returns {number} Angle en radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Formater une distance en format lisible
 * @param {number} meters - Distance en mètres
 * @returns {string} Distance formatée (ex: "1.5 km" ou "500 m")
 */
function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Vérifier si un point est dans un rayon donné
 * @param {number} lat1 - Latitude du centre
 * @param {number} lon1 - Longitude du centre
 * @param {number} lat2 - Latitude du point à tester
 * @param {number} lon2 - Longitude du point à tester
 * @param {number} radius - Rayon en mètres
 * @returns {boolean} true si le point est dans le rayon
 */
function isWithinRadius(lat1, lon1, lat2, lon2, radius) {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radius;
}

module.exports = {
  calculateDistance,
  formatDistance,
  isWithinRadius,
  toRadians
};
