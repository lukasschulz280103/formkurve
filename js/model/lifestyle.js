// Was das Logbuch und der Check-in über den Tag sagen: Alkohol, Koffein, Wasser.
// Zwei Aufgaben: ein kleiner, gedeckelter Zuschlag auf die Tagesform – und die Erklärung,
// warum ein Nachtwert heute aus dem Rahmen fällt. Beides nennt immer seinen Grund.
import { isNum } from '../core/stats.js';

/** Uhrzeit eines Logbuch-Eintrags in Minuten seit Mitternacht des Logbuch-Tags. */
function hourOf(ms) {
  if (!isNum(ms)) return null;
  const d = new Date(ms);
  const h = d.getHours();
  // Nach Mitternacht gehört der Eintrag noch zum Abend davor
  return h < 4 ? h + 24 : h;
}

/** Hat der Abend davor Alkohol gesehen? Aus dem Abendcheck, sonst aus dem Logbuch. */
export function alcoholOf(day) {
  if (!day) return null;
  // `answers` ist der Check-in samt Logbuch; ohne Pipeline nur die Antworten selbst
  const a = day.answers || day.survey?.a || {};
  if (a.A3 !== true) return a.A3 === false ? { drinks: 0 } : null;
  return { drinks: isNum(a.X1) ? a.X1 : null, at: typeof a.X2 === 'string' ? a.X2 : null };
}

/**
 * Zuschlag auf die Tagesform aus dem Lebensstil, in Punkten. Immer gedeckelt und immer
 * mit Begründung. Gewertet wird der Vortag, weil der heutige Tag noch nicht zu Ende ist.
 */
export function lifestyleAdjust({ day, prev, settings }) {
  const p = settings?.model?.form?.lifestyle;
  if (!p || p.on === false) return { delta: 0, reasons: [] };
  const reasons = [];
  const add = (id, points, text) => reasons.push({ id, points, text });

  const alc = alcoholOf(day) || alcoholOf(prev);
  if (alc && (alc.drinks === null || alc.drinks > 0)) {
    const n = isNum(alc.drinks) ? alc.drinks : 1;
    const pts = Math.min(p.alcoholCap, p.alcohol + Math.max(0, n - 1) * p.alcoholPerDrink);
    add('alkohol', -pts, n > 1 ? `Alkohol am Abend davor (${n} Getränke)` : 'Alkohol am Abend davor');
  }

  // Wasser und Koffein vom Vortag: der heutige Tag ist noch nicht gelaufen
  const j = prev?.journal;
  const goal = settings?.journal?.waterGoalMl || 2000;
  if (j && isNum(j.waterMl) && j.waterMl < goal * p.waterFrac) {
    add('wasser', -p.water, `Gestern wenig getrunken (${(j.waterMl / 1000).toFixed(1).replace('.', ',')} l von ${(goal / 1000).toFixed(1).replace('.', ',')} l)`);
  } else if (j && isNum(j.waterMl) && j.waterMl >= goal * p.waterGood) {
    add('wasser', p.bonus, 'Trinkziel gestern erreicht');
  }
  if (j && isNum(j.caffeineMg) && j.caffeineMg > p.highMg) {
    add('koffein', -p.caffeineHigh, `Gestern viel Koffein (${Math.round(j.caffeineMg)} mg)`);
  }
  const last = hourOf(j?.caffeineLast);
  if (isNum(last) && last >= p.lateHour) {
    add('koffein-spaet', -p.caffeineLate, `Letztes Koffein gestern um ${String(Math.floor(last % 24)).padStart(2, '0')} Uhr`);
  }

  // Verschobener Schlafrhythmus: um 5 Uhr ins Bett ist etwas anderes als früh schlafen gehen
  const shift = day?.sleepShiftH;
  if (isNum(shift) && shift >= p.shiftSmall) {
    const big = shift >= p.shiftBig;
    add('rhythmus', -(big ? p.shiftBigPts : p.shiftSmallPts),
      `Schlaf ${shift.toFixed(1).replace('.', ',')} h später als sonst`);
  }

  const sum = reasons.reduce((s, r) => s + r.points, 0);
  const delta = Math.max(-p.cap, Math.min(p.bonus, sum));
  return { delta, reasons };
}

/**
 * `label` steht als Überschrift, `cause` im Satz „Das kann auch an … liegen“.
 * Bekannte Erklärungen für auffällige Nachtwerte. `day` ist die Nacht selbst,
 * `prev` der Tag davor. Jede Erklärung sagt, welche Werte sie typischerweise verschiebt.
 */
export function nightDisturbances(day, prev, settings) {
  const p = settings?.model?.warn || {};
  const out = [];
  const alc = alcoholOf(day) || alcoholOf(prev);
  if (alc && (alc.drinks === null || alc.drinks > 0)) {
    out.push({
      id: 'alkohol',
      label: 'Alkohol am Abend davor',
      cause: 'Alkohol am Abend davor',
      affects: ['rhr', 'hrv'],
      text: 'Alkohol hebt den Ruhepuls in der Nacht typischerweise um 5 bis 10 bpm und senkt die HRV deutlich, oft noch die zweite Nacht danach.',
    });
  }
  if (isNum(prev?.strain) && prev.strain >= (p.hardStrain ?? 70)) {
    out.push({
      id: 'training',
      label: 'Hartes Training am Tag davor',
      cause: 'hartem Training am Tag davor',
      affects: ['rhr', 'hrv', 'resp'],
      text: `Strain ${Math.round(prev.strain)} am Vortag. Nach harten Einheiten bleibt der Puls nachts erhöht und die HRV gedämpft.`,
    });
  }
  const late = hourOf(prev?.journal?.caffeineLast);
  if (isNum(late) && late >= (settings?.model?.form?.lifestyle?.lateHour ?? 17)) {
    out.push({
      id: 'koffein',
      label: 'Spätes Koffein',
      cause: 'spätem Koffein am Abend',
      affects: ['hrv'],
      text: `Letztes Koffein gestern um ${String(Math.floor(late % 24)).padStart(2, '0')} Uhr. Das verzögert den Tiefschlaf und dämpft die HRV der ersten Nachthälfte.`,
    });
  }
  if (isNum(day?.sleepShiftH) && day.sleepShiftH >= (settings?.model?.form?.lifestyle?.shiftBig ?? 3)) {
    out.push({
      id: 'rhythmus',
      label: 'Stark verschobener Rhythmus',
      cause: 'dem verschobenen Schlafrhythmus',
      affects: ['rhr', 'hrv'],
      text: `Du bist ${day.sleepShiftH.toFixed(1).replace('.', ',')} h später schlafen gegangen als sonst. Das allein hebt den Ruhepuls und senkt die HRV.`,
    });
  }
  if (day?.sleep && day.sleep.asleepMin < 5 * 60) {
    out.push({
      id: 'kurz',
      label: 'Sehr kurze Nacht',
      cause: 'der sehr kurzen Nacht',
      affects: ['hrv', 'rhr'],
      text: `Nur ${(day.sleep.asleepMin / 60).toFixed(1).replace('.', ',')} h geschlafen. Kurze Nächte heben den Ruhepuls und senken die HRV.`,
    });
  }
  return out;
}

/** Nachtwerte, die heute auffallen, zusammen mit ihrer möglichen Erklärung. */
export function explainNight(day, prev, settings) {
  const z = day?.z || {};
  const dist = nightDisturbances(day, prev, settings);
  const thr = settings?.model?.warn?.z ?? 1.5;
  const odd = [];
  if (isNum(z.rhr) && z.rhr >= 1) odd.push({ key: 'rhr', label: 'Ruhepuls', dir: 'über', z: z.rhr });
  if (isNum(z.hrv) && z.hrv <= -1) odd.push({ key: 'hrv', label: 'HRV', dir: 'unter', z: z.hrv });
  if (isNum(z.resp) && z.resp >= 1) odd.push({ key: 'resp', label: 'Atemfrequenz', dir: 'über', z: z.resp });
  const causes = odd.length ? dist.filter((x) => x.affects.some((k) => odd.some((o) => o.key === k))) : [];
  return { odd, causes, strong: odd.some((o) => Math.abs(o.z) >= thr) };
}
