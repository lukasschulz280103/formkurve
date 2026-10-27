// Standort für Wetter, Luftqualität und Pollen. Gespeichert und gesendet werden nur auf
// zwei Nachkommastellen gerundete Koordinaten (etwa 1 km genau).
export const round2 = (x) => Math.round(x * 100) / 100;

export async function permissionState() {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    return p?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function currentPosition({ timeout = 12000, maximumAge = 3 * 3600000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(new Error('Dieses Gerät gibt keinen Standort frei.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: round2(p.coords.latitude), lon: round2(p.coords.longitude) }),
      (e) => reject(new Error(e?.code === 1 ? 'Standortzugriff abgelehnt. Du kannst ihn in den iPhone-Einstellungen erlauben oder den Ort von Hand suchen.' : 'Standort nicht verfügbar.')),
      { enableHighAccuracy: false, timeout, maximumAge },
    );
  });
}

export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatPlace(place) {
  if (!place) return 'kein Ort';
  if (place.name) return place.region ? `${place.name}, ${place.region}` : place.name;
  const ns = place.lat >= 0 ? 'N' : 'S';
  const ew = place.lon >= 0 ? 'O' : 'W';
  const f = (x) => Math.abs(x).toFixed(2).replace('.', ',');
  return `Aktueller Standort (${f(place.lat)}° ${ns}, ${f(place.lon)}° ${ew})`;
}
