// Wetter, Luftqualität und Pollen von Open-Meteo (kostenlos für private Nutzung, ohne Konto).
// Wetterdaten: Open-Meteo.com (CC BY 4.0); Luftqualität und Pollen: CAMS über Open-Meteo.
import { addDays } from '../core/time.js';
import { isNum, mean } from '../core/stats.js';

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  } catch {
    return 'Europe/Berlin';
  }
};

export async function searchPlace(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=de&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ortssuche fehlgeschlagen (${res.status})`);
  const j = await res.json();
  return (j.results || []).map((r) => ({ name: r.name, region: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
}

/** Holt bis zu 92 Tage Vergangenheit und bildet Tageswerte. */
export async function fetchContext(place, pastDays = 92) {
  const base = `latitude=${place.lat}&longitude=${place.lon}&timezone=${encodeURIComponent(tz())}&past_days=${pastDays}&forecast_days=1`;
  const wUrl = `https://api.open-meteo.com/v1/forecast?${base}&hourly=temperature_2m,relative_humidity_2m,surface_pressure&daily=temperature_2m_max,temperature_2m_min,daylight_duration,sunshine_duration,precipitation_sum`;
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${base}&hourly=pm2_5,pm10,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen`;
  const [w, a] = await Promise.all([
    fetch(wUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Wetter: ${r.status}`)))),
    fetch(aUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  return aggregate(w, a);
}

/** Wandelt Stundenwerte in Tageswerte um. Die Nacht gehört zum Abend-Datum (22 bis 7 Uhr). */
export function aggregate(w, a) {
  const days = new Map();
  const get = (d) => {
    if (!days.has(d)) days.set(d, { date: d });
    return days.get(d);
  };
  if (w?.daily?.time) {
    w.daily.time.forEach((d, i) => {
      const x = get(d);
      x.tMax = w.daily.temperature_2m_max?.[i] ?? null;
      x.tMin = w.daily.temperature_2m_min?.[i] ?? null;
      x.daylightH = isNum(w.daily.daylight_duration?.[i]) ? w.daily.daylight_duration[i] / 3600 : null;
      x.sunshineH = isNum(w.daily.sunshine_duration?.[i]) ? w.daily.sunshine_duration[i] / 3600 : null;
      x.precip = w.daily.precipitation_sum?.[i] ?? null;
    });
  }
  const hourly = (src, key) => {
    const out = new Map();
    if (!src?.hourly?.time) return out;
    src.hourly.time.forEach((iso, i) => {
      const v = src.hourly[key]?.[i];
      if (!isNum(v)) return;
      const d = iso.slice(0, 10);
      const h = Number(iso.slice(11, 13));
      // Nacht: 22-23 Uhr zum selben Tag, 0-6 Uhr zum Vortag
      const nightDay = h >= 22 ? d : h < 7 ? addDays(d, -1) : null;
      if (!out.has(d)) out.set(d, { day: [], night: [] });
      out.get(d).day.push(v);
      if (nightDay) {
        if (!out.has(nightDay)) out.set(nightDay, { day: [], night: [] });
        out.get(nightDay).night.push(v);
      }
    });
    return out;
  };
  const temp = hourly(w, 'temperature_2m');
  const hum = hourly(w, 'relative_humidity_2m');
  const pres = hourly(w, 'surface_pressure');
  for (const [d, v] of temp) if (v.night.length >= 6) get(d).nightTempMin = Math.min(...v.night);
  for (const [d, v] of hum) if (v.night.length >= 6) get(d).nightHumidity = mean(v.night);
  for (const [d, v] of pres) if (v.day.length >= 12) get(d).pressure = mean(v.day);
  if (a) {
    const pm25 = hourly(a, 'pm2_5');
    const pm10 = hourly(a, 'pm10');
    const ozone = hourly(a, 'ozone');
    for (const [d, v] of pm25) if (v.day.length >= 12) get(d).pm25 = mean(v.day);
    for (const [d, v] of pm10) if (v.day.length >= 12) get(d).pm10 = mean(v.day);
    for (const [d, v] of ozone) if (v.day.length >= 12) get(d).ozoneMax = Math.max(...v.day);
    const pollenKeys = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'ragweed_pollen'];
    const pollen = pollenKeys.map((k) => hourly(a, k));
    for (const d of new Set(pollen.flatMap((m) => [...m.keys()]))) {
      const maxes = pollen.map((m) => (m.get(d)?.day.length ? Math.max(...m.get(d).day) : null)).filter(isNum);
      if (maxes.length) get(d).pollenMax = Math.max(...maxes);
    }
  }
  const sorted = [...days.keys()].sort();
  for (const d of sorted) {
    const x = days.get(d);
    const prev = days.get(addDays(d, -1));
    if (isNum(x.pressure) && isNum(prev?.pressure)) x.pressureDelta = x.pressure - prev.pressure;
  }
  return days;
}

export const ATTRIBUTION = 'Wetter: Open-Meteo.com (CC BY 4.0). Luftqualität und Pollen: Copernicus Atmosphere Monitoring Service (CAMS) über Open-Meteo.';
