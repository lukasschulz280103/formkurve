// Liest die Ausgabe des Kurzbefehls "Formkurve Sync".
// Format je Zeile: Typ;Start;Ende;Wert;Einheit;Quelle  (Trennzeichen ; | oder Tab)
// Alternativ JSON: [{type,start,end,value,unit,source}] oder {samples:[...]}.
import { parseLooseDate } from '../core/time.js';
import { typeFromName, normalizeValue } from '../data/normalize.js';

function emptyStats() {
  return { lines: 0, parsed: 0, skipped: 0, implausible: 0, unknownTypes: {}, byType: {}, sources: {}, minT: null, maxT: null };
}

function addSample(out, stats, rawType, start, end, value, unit, source) {
  const type = typeFromName(rawType);
  if (!type) {
    const key = String(rawType || '').trim() || '(leer)';
    stats.unknownTypes[key] = (stats.unknownTypes[key] || 0) + 1;
    stats.skipped++;
    return;
  }
  const t = parseLooseDate(start);
  let e = parseLooseDate(end);
  if (!Number.isFinite(t)) {
    stats.skipped++;
    return;
  }
  if (!Number.isFinite(e) || e < t) e = t;
  const v = normalizeValue(type, value, unit);
  if (!Number.isFinite(v)) {
    stats.implausible++;
    return;
  }
  const src = String(source || '').trim() || 'Kurzbefehl';
  out.push({ type, t, e, v, src });
  stats.parsed++;
  stats.byType[type] = (stats.byType[type] || 0) + 1;
  stats.sources[src] = (stats.sources[src] || 0) + 1;
  if (stats.minT == null || t < stats.minT) stats.minT = t;
  if (stats.maxT == null || e > stats.maxT) stats.maxT = e;
}

export function parseShortcutText(text) {
  const samples = [];
  const stats = emptyStats();
  const s = String(text || '').replace(/^﻿/, '').trim();
  if (!s) return { samples, stats };

  if (s[0] === '[' || s[0] === '{') {
    try {
      const j = JSON.parse(s);
      const list = Array.isArray(j) ? j : j.samples || j.data || [];
      for (const r of list) {
        stats.lines++;
        addSample(samples, stats, r.type ?? r.typ, r.start ?? r.startDate ?? r.date, r.end ?? r.endDate, r.value ?? r.wert ?? r.qty, r.unit ?? r.einheit, r.source ?? r.quelle);
      }
      return { samples, stats };
    } catch {
      // weiter als Zeilenformat
    }
  }

  for (const rawLine of s.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    stats.lines++;
    const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : '|';
    // Die ersten fünf Felder trennen; der Rest ist die Quelle (darf das Trennzeichen enthalten).
    const parts = [];
    let rest = line;
    for (let k = 0; k < 5; k++) {
      const pos = rest.indexOf(sep);
      if (pos < 0) break;
      parts.push(rest.slice(0, pos).trim());
      rest = rest.slice(pos + sep.length);
    }
    parts.push(rest.trim());
    if (parts.length < 4) {
      stats.skipped++;
      continue;
    }
    if (/^typ(e)?$/i.test(parts[0])) {
      stats.lines--;
      continue; // Kopfzeile
    }
    const [type, start, end, value, unit = '', source = ''] = parts;
    addSample(samples, stats, type, start, end, value, unit, source);
  }
  return { samples, stats };
}
