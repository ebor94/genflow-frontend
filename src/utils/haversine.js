/**
 * haversine — distancia entre dos puntos geo en kilómetros.
 */
const R = 6371; // radio Tierra km

function toRad(d) { return (d * Math.PI) / 180; }

export function haversine(a, b) {
  if (!a || !b) return 0;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/**
 * sumaDistancias — suma consecutiva entre puntos (km).
 */
export function sumaDistancias(coords = []) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1], coords[i]);
  }
  return total;
}
