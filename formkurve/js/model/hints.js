// Hinweise und Zusammenfassung für einen Tag. Keine Diagnosen, nur Muster aus deinen Daten.
import { isNum } from '../core/stats.js';

export function buildHints(d, prev, settings) {
  const out = [];
  const z = d.z || {};
  const m = settings.model;
  if (isNum(z.rhr) && z.rhr >= 1.5 && ((isNum(z.temp) && z.temp >= 1.5) || (isNum(z.resp) && z.resp >= 1.5) || (isNum(z.hrv) && z.hrv <= -1.5))) {
    out.push({ level: 'critical', title: 'Mögliches Krankheitssignal', text: 'Ruhepuls deutlich über deinem Normalbereich, zusammen mit auffälliger HRV, Atemfrequenz oder Temperatur. Gönn dir Ruhe. Das ist keine Diagnose; bei Beschwerden ärztlichen Rat einholen.' });
  }
  if (isNum(d.form) && d.form < 40 && isNum(prev?.form) && prev.form < 40 && isNum(z.rhr) && z.rhr > 1) {
    out.push({ level: 'warning', title: 'Zwei schwache Tage in Folge', text: 'Tagesform unter 40 und Ruhepuls erhöht. Ein lockerer Tag hilft meist mehr als ein hartes Training.' });
  }
  if (isNum(d.acwr) && d.acwr > 1.5) {
    out.push({ level: 'warning', title: 'Belastungsspitze', text: `Die letzten 7 Tage waren ${Math.round((d.acwr - 1) * 100)} % belastender als dein 4-Wochen-Schnitt.` });
  }
  if (isNum(d.sleepDebtH) && d.sleepDebtH >= 1.5) {
    out.push({ level: 'warning', title: 'Schlafschuld', text: `Dir fehlten letzte Nacht etwa ${d.sleepDebtH.toFixed(1).replace('.', ',')} h zum Schlafbedarf.` });
  }
  if ((isNum(d.spo2) && d.spo2 < 92) || (isNum(d.spo2Min) && d.spo2Min < 85)) {
    out.push({ level: 'warning', title: 'Niedrige Sauerstoffwerte', text: 'Nachts gemessene SpO₂-Werte waren niedrig. Einzelwerte sind oft Messfehler; wiederholt sich das, ärztlich abklären lassen.' });
  }
  if (d.sleep?.incomplete) {
    out.push({ level: 'info', title: 'Kurze oder unvollständige Nacht', text: 'Weniger als 4 Stunden Schlafdaten. Die Nacht zählt nicht zur Baseline.' });
  }
  if (isNum(d.hrv) && d.hrvNightly === false) {
    out.push({ level: 'info', title: 'HRV nicht aus der Nacht', text: 'Für diese Nacht gab es keinen HRV-Wert im Schlaffenster; verwendet wird ein Wert vom selben Tag.' });
  }
  if (d.excluded) {
    out.push({ level: 'info', title: `Ausnahmetag: ${d.excluded}`, text: 'Dieser Tag fließt nicht in deine Baseline ein.' });
  }
  if (!d.calibrated && (isNum(d.rhr) || isNum(d.hrv))) {
    const left = Math.max(0, m.baselineMinDays - (d.baselineDays || 0));
    out.push({ level: 'info', title: 'Kalibrierung läuft', text: left ? `Noch etwa ${left} Nächte, bis deine Baseline stabil ist. Bis dahin sind die Scores vorläufig.` : 'Baseline wird aufgebaut.' });
  }
  return out;
}

const COMP_LABEL = { hrv: 'HRV', rhr: 'Ruhepuls', sleep: 'Schlaf', vital: 'Vitalwerte', subj: 'dein Gefühl' };

/** Ein Satz zur Tagesform plus Hauptgrund. */
export function summarize(d, settings) {
  if (!d || !isNum(d.form)) return null;
  const { red, green } = settings.model.recovery;
  let lead;
  if (isNum(d.recovery) && d.recovery < red && d.form >= red) lead = 'Die Tagesform hält sich, aber die Recovery ist heute niedrig. Lieber locker trainieren.';
  else if (d.form >= green) lead = 'Gute Tagesform. Ein guter Tag für intensives Training.';
  else if (d.form >= red) lead = 'Mittlere Tagesform. Moderates Training passt.';
  else lead = 'Niedrige Tagesform. Heute eher Erholung, Schlaf und lockere Bewegung.';
  const parts = Object.entries(d.recoveryParts || {}).filter(([, v]) => Math.abs(v) >= 3);
  if (!parts.length) return lead;
  parts.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [key, val] = parts[0];
  const dir = val < 0 ? 'drückt' : 'hebt';
  return `${lead} ${COMP_LABEL[key]} ${dir} die Recovery um ${Math.abs(Math.round(val))} Punkte.`;
}
