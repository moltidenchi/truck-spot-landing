// Small geo helpers (no dependencies).

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two { lat, lng } points (haversine). */
export function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point `east` / `north` metres away from `center` (good enough for a few kilometres). */
export function offsetLatLng(center, east, north) {
  const lat = center.lat + (north / EARTH_RADIUS_M) * (180 / Math.PI);
  const lng = center.lng + (east / (EARTH_RADIUS_M * Math.cos(toRad(center.lat)))) * (180 / Math.PI);
  return { lat, lng };
}

/** "350 m", "1.2 km" or "0.4 mi" / "2.1 mi" depending on units ("metric" | "imperial"). */
export function formatDistance(meters, units = "metric") {
  if (units === "imperial") {
    const miles = meters / 1609.344;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Imperial for US, Liberia and Myanmar locales; metric elsewhere. */
export function unitsForLocale(locale = "en") {
  const region = (String(locale).split(/[-_]/)[1] || "").toUpperCase();
  return ["US", "LR", "MM"].includes(region) ? "imperial" : "metric";
}
