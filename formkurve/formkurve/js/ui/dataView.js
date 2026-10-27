// Ansicht "Daten": Import, Diagnose, Quellen, Kurzbefehl-Anleitung, Einstellungen, Backup.
import { html, useState, useRef } from '../vendor/preact-htm.js';
import { state, update, importShortcutText, importHealthExport, saveSettings, refreshContext, setDemo, resetDemo, toast, recompute } from './state.js';
import { Topbar, DemoBanner } from './today.js';
import { Segmented, Switch, Stepper, Progress } from './components.js';
import { Icon } from './icons.js';
import { num, ago, mb, dateShort } from './format.js';
import { TYPES } from '../data/normalize.js';
import { PARAMS, DEFAULTS, getPath, setPath, hrMaxOf, clone } from '../core/config.js';
import { searchPlace, ATTRIBUTION } from '../context/weather.js';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const REQUIRED = ['hr', 'hrv', 'sleep'];
const EXAMPLE = 'Herzfrequenz;2026-10-26T03:12:00+01:00;2026-10-26T03:12:00+01:00;54;count/min;Zepp';

function ImportSummary({ s }) {
  if (!s) return null;
  const types = Object.entries(s.byType || {});
  const unknown = Object.entries(s.unknownTypes || {});
  return html`<div class="stack small">
    <div class="row between"><b>${s.kind === 'export' ? 'Health-Export' : s.kind === 'demo' ? 'Beispieldaten' : 'Kurzbefehl'}</b><span class="muted">${ago(s.at)}</span></div>
    <p class="ink2">${num(s.parsed ?? s.used ?? 0)} Werte gelesen, davon ${num(s.added ?? 0)} neu${s.implausible ? `, ${num(s.implausible)} unplausible verworfen` : ''}${s.old ? `, ${num(s.old)} zu alt` : ''}${s.workouts ? `, ${num(s.workouts)} Workouts` : ''}.</p>
    ${types.length ? html`<div class="typegrid">${types.map(([t, n]) => html`<span>${TYPES[t]?.label || t}</span><span class="tnum">${num(n)}</span><span></span>`)}</div>` : null}
    ${unknown.length ? html`<p class="muted">Nicht erkannt: ${unknown.map(([k, n]) => `${k} (${n})`).join(', ')}</p>` : null}
  </div>`;
}

function Diagnose() {
  const idx = state.repo.index;
  const types = Object.keys(TYPES).filter((t) => idx.counts[t]);
  if (!types.length) return null;
  return html`<section class="card">
    <div class="card-head"><h2>Was in deinen Daten steckt</h2></div>
    <div class="typegrid">
      <span class="h">Typ</span><span class="h">Werte</span><span class="h">Zeitraum</span>
      ${types.map((t) => {
        const total = Object.values(idx.counts[t]).reduce((s, x) => s + x, 0);
        const r = idx.range[t];
        return html`<span>${TYPES[t].label}</span><span class="tnum">${num(total)}</span><span class="tnum muted">${dateShort(r[0])} – ${dateShort(r[1])}</span>`;
      })}
    </div>
    <hr class="divider" />
    <div class="stack small">
      ${REQUIRED.map((t) => html`<div class="row"><span class=${idx.counts[t] ? 'ok' : 'bad'}><${Icon} name=${idx.counts[t] ? 'ok' : 'alert'} size=${16} /></span>
        <span>${TYPES[t].label}: ${idx.counts[t] ? 'vorhanden' : 'fehlt – für Recovery nötig. Prüfe die Zepp-Freigaben in Health.'}</span></div>`)}
    </div>
  </section>`;
}

function Sources() {
  const idx = state.repo.index;
  const all = new Map();
  for (const [t, c] of Object.entries(idx.counts)) for (const [src, n] of Object.entries(c)) all.set(src, (all.get(src) || 0) + n);
  if (all.size < 2) return null;
  const settings = state.repo.settings;
  const current = settings.import.sourcePriority?.length ? settings.import.sourcePriority.filter((s) => all.has(s)) : [];
  const order = [...current, ...[...all.keys()].sort((a, b) => (/zepp|amazfit/i.test(b) ? 1 : 0) - (/zepp|amazfit/i.test(a) ? 1 : 0) || all.get(b) - all.get(a)).filter((s) => !current.includes(s))];
  const move = async (i, dir) => {
    const next = order.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    await saveSettings(setPath(settings, 'import.sourcePriority', next));
    toast('Reihenfolge gespeichert');
  };
  return html`<section class="card">
    <div class="card-head"><h2>Quellen</h2></div>
    <p class="small muted" style="margin-bottom:8px">Je Typ und Tag zählt nur die oberste Quelle mit Daten. So verdoppeln sich Schritte von iPhone und Strap nicht.</p>
    <div class="list">${order.map((src, i) => html`<div class="list-row">
      <span class="t">${i + 1}. ${src}</span>
      <span class="row" style="gap:2px">
        <button class="iconbtn" aria-label=${`${src} nach oben`} disabled=${i === 0} onClick=${() => move(i, -1)}><${Icon} name="up" size=${18} /></button>
        <button class="iconbtn" aria-label=${`${src} nach unten`} disabled=${i === order.length - 1} onClick=${() => move(i, 1)}><${Icon} name="down" size=${18} /></button>
      </span>
      <span class="d">${num(all.get(src))} Werte</span>
    </div>`)}</div>
  </section>`;
}

function ShortcutGuide() {
  return html`<details class="card more" id="kurzbefehl">
    <summary>Kurzbefehl „Formkurve Sync“ einrichten <${Icon} name="down" size=${18} /></summary>
    <div class="stack small ink2" style="margin-top:10px">
      <p>Ein Browser darf Apple Health nicht lesen. Der Kurzbefehl holt die Werte der letzten zwei Tage und kopiert sie als Text; die App liest ihn ein. Einmal einrichten dauert etwa 10 Minuten.</p>
      <ol class="steps">
        <li><span>Öffne die App <b>Kurzbefehle</b>, tippe auf <b>+</b> und nenne den Kurzbefehl <b>Formkurve Sync</b>.</span></li>
        <li><span>Suche bei „Aktion hinzufügen“ nach <b>Health</b> und wähle die Aktion zum Suchen von Health-Daten (englisch „Find Health Samples“). Filter: <b>Typ ist Herzfrequenz</b> und <b>Startdatum ist in den letzten 2 Tagen</b>, sortiert nach Startdatum.</span></li>
        <li><span>Füge <b>Zu Variable hinzufügen</b> an und nenne die Variable <code>Proben</code>.</span></li>
        <li><span>Wiederhole Schritt 2 und 3 für <b>Herzfrequenzvariabilität, Ruheherzfrequenz, Atemfrequenz, Blutsauerstoff, Schritte</b> und <b>Schlafanalyse</b>.</span></li>
        <li><span>Füge <b>Wiederholen mit jedem Objekt</b> hinzu, Eingabe: <code>Proben</code>.</span></li>
        <li><span>Lege in die Wiederholung eine <b>Text</b>-Aktion mit sechs Eigenschaften von <b>Wiederholungsobjekt</b>, getrennt durch Semikolon: Typ ; Startdatum ; Enddatum ; Wert ; Einheit ; Quelle. Bei den beiden Daten als Format <b>ISO 8601</b> wählen, falls angeboten.</span></li>
        <li><span>Nach „Ende der Wiederholung“: <b>Text kombinieren</b> mit den Wiederholungsergebnissen, Trennzeichen <b>Neue Zeilen</b>, danach <b>In Zwischenablage kopieren</b>.</span></li>
        <li><span>Beim ersten Start fragt iOS nach dem Zugriff auf Health. Erlaube alle Typen.</span></li>
      </ol>
      <p>Jede Zeile sieht dann etwa so aus:</p>
      <pre class="code">${EXAMPLE}</pre>
      <p>Täglich: Kurzbefehl ausführen, Formkurve öffnen, <b>Einfügen und importieren</b>. Das Datumsformat darf auch deutsch sein (25.10.2026, 07:59); Werte mit Komma werden erkannt. Doppelte Zeilen schaden nicht.</p>
      <p class="muted">Tipp: Eine Automation „Wenn Wecker gestoppt wird“ kann den Kurzbefehl starten. Läuft er dir zu langsam, stelle den Zeitraum auf 1 Tag. Für die Historie oder Lücken nimm den Health-Export.</p>
    </div>
  </details>`;
}

function PasteImport() {
  const [text, setText] = useState('');
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const run = async (t) => {
    setErr(null);
    try {
      const s = await importShortcutText(t);
      setText('');
      toast(s.added ? `${num(s.added)} neue Werte importiert` : 'Keine neuen Werte, alles war schon da');
    } catch (e) {
      setErr(e.message);
    }
  };
  const fromClipboard = async () => {
    setErr(null);
    try {
      const t = await navigator.clipboard.readText();
      if (!t) throw new Error('leer');
      await run(t);
    } catch {
      setErr('Die Zwischenablage ließ sich nicht direkt lesen. Tippe lange in das Feld und wähle „Einsetzen“.');
      document.getElementById('paste')?.focus();
    }
  };
  const fromFile = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    await run(await f.text());
  };
  return html`<div class="stack">
    <button class="btn primary block" onClick=${fromClipboard}><${Icon} name="clipboard" size=${18} />Einfügen und importieren</button>
    <textarea id="paste" class="field mono" rows="3" placeholder="Oder hier einsetzen: Typ;Start;Ende;Wert;Einheit;Quelle" value=${text}
      onInput=${(e) => setText(e.currentTarget.value)} onPaste=${(e) => {
        const t = e.clipboardData?.getData('text');
        if (t && t.length > 2000) {
          e.preventDefault();
          run(t);
        }
      }}></textarea>
    <div class="row wrap">
      <button class="btn small" disabled=${!text.trim()} onClick=${() => run(text)}>Text importieren</button>
      <button class="btn small ghost" onClick=${() => fileRef.current?.click()}><${Icon} name="file" size=${16} />Textdatei wählen</button>
      <input ref=${fileRef} type="file" accept=".txt,.json,.csv,text/plain,application/json" hidden onChange=${fromFile} />
    </div>
    ${err ? html`<p class="small" style="color:var(--crit)">${err}</p>` : null}
  </div>`;
}

function ExportImport() {
  const fileRef = useRef(null);
  const [err, setErr] = useState(null);
  const pick = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    setErr(null);
    try {
      const s = await importHealthExport(f);
      toast(s.added ? `${num(s.added)} neue Werte aus dem Export` : 'Keine neuen Werte, alles war schon da');
    } catch (x) {
      console.error(x);
      setErr(x.message || 'Import fehlgeschlagen');
    }
  };
  const p = state.progress;
  return html`<div class="stack">
    <button class="btn block" onClick=${() => fileRef.current?.click()}><${Icon} name="import" size=${18} />Apple-Health-Export wählen</button>
    <input ref=${fileRef} type="file" accept=".zip,.xml,application/zip,text/xml" hidden onChange=${pick} />
    <p class="small muted">Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“ → in Dateien sichern, dann hier die export.zip wählen. Gelesen werden die letzten ${state.repo.settings.import.windowDays} Tage.</p>
    ${p ? html`<div class="stack small"><${Progress} ratio=${p.ratio} /><span class="muted tnum">${mb(p.ratio * p.total)} von ${mb(p.total)} · ${num(p.used || 0)} Werte</span></div>` : null}
    ${err ? html`<p class="small" style="color:var(--crit)">${err}</p>` : null}
  </div>`;
}

function Profile() {
  const s = state.repo.settings;
  const set = (path, v) => saveSettings(setPath(s, path, v));
  return html`<section class="card">
    <div class="card-head"><h2>Profil</h2></div>
    <div class="list">
      <div class="list-row"><span class="t">Alter</span><${Stepper} id="age" value=${s.profile.age} min=${14} max=${90} step=${1} onChange=${(v) => v && set('profile.age', v)} /></div>
      <div class="list-row"><span class="t">Maximalpuls</span><${Stepper} id="hrmax" value=${s.profile.hrMax ?? hrMaxOf(s)} min=${140} max=${220} step=${1} onChange=${(v) => set('profile.hrMax', v || null)} />
        <span class="d">${s.profile.hrMax ? 'eigener Wert' : 'geschätzt: 208 − 0,7 × Alter'}${s.profile.hrMax ? html` · <button class="linkbtn" onClick=${() => set('profile.hrMax', null)}>Schätzung nutzen</button>` : null}</span></div>
      <div class="list-row"><span class="t">Schlafbedarf (Basis)</span><${Stepper} id="need" value=${s.profile.sleepNeedBase} min=${5} max=${11} step=${0.25} unit="h" onChange=${(v) => v && set('profile.sleepNeedBase', v)} /></div>
      <div class="list-row"><span class="t">HRV-Tagesversatz</span><span></span>
        <span class="d">Einschalten, falls Zepp HRV-Werte einen Tag zu früh einträgt.</span>
        <div style="grid-column:1 / -1"><${Segmented} label="HRV-Tagesversatz" value=${s.import.hrvDayShift} onChange=${(v) => set('import.hrvDayShift', v)} options=${[{ value: 0, label: 'aus' }, { value: 1, label: '+1 Tag' }]} /></div></div>
    </div>
  </section>`;
}

function DayPicker({ value, onChange, label }) {
  return html`<div class="daygrid" role="group" aria-label=${label}>${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button type="button" class="chip" aria-pressed=${value.includes(d) ? 'true' : 'false'}
    onClick=${() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort())}>${WEEKDAYS[d]}</button>`)}</div>`;
}

function Preferences() {
  const s = state.repo.settings;
  const set = (path, v) => saveSettings(setPath(s, path, v));
  return html`<section class="card">
    <div class="card-head"><h2>Anzeige und Check-in</h2></div>
    <div class="list">
      <div class="list-row"><span class="t">Erscheinungsbild</span><span></span>
        <div style="grid-column:1 / -1"><${Segmented} label="Erscheinungsbild" value=${s.display.theme} onChange=${(v) => set('display.theme', v)} options=${[{ value: 'auto', label: 'Auto' }, { value: 'dark', label: 'Dunkel' }, { value: 'light', label: 'Hell' }]} /></div></div>
      <div class="list-row"><span class="t">Scores erst nach dem Morgencheck</span><${Switch} id="gate" label="Scores erst nach dem Morgencheck" checked=${s.display.hideScoresUntilMorning} onChange=${(v) => set('display.hideScoresUntilMorning', v)} />
        <span class="d">Verhindert, dass die Zahl dein Gefühl beeinflusst.</span></div>
      <div class="list-row"><span class="t">Nikotin und Cannabis abfragen</span><${Switch} id="nic" label="Nikotin und Cannabis abfragen" checked=${s.survey.askNicotine} onChange=${(v) => set('survey.askNicotine', v)} /></div>
      <div class="list-row"><span class="t">Sensible Fragen</span><${Switch} id="sens" label="Sensible Fragen" checked=${s.survey.sensitive} onChange=${(v) => set('survey.sensitive', v)} />
        <span class="d">Zum Beispiel Intimität. Bleibt nur auf dem iPhone.</span></div>
      <div class="list-row"><span class="t">Ernährungsmodul an</span><span></span><span class="d"><${DayPicker} label="Ernährungsmodul" value=${s.survey.nutritionDays} onChange=${(v) => set('survey.nutritionDays', v)} /></span></div>
      <div class="list-row"><span class="t">Stressmodul an</span><span></span><span class="d"><${DayPicker} label="Stressmodul" value=${s.survey.stressDays} onChange=${(v) => set('survey.stressDays', v)} /></span></div>
      <div class="list-row"><span class="t">Wochenrückblick am</span><span></span><span class="d"><div class="daygrid" role="group" aria-label="Wochenrückblick">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button type="button" class="chip" aria-pressed=${s.survey.weeklyDay === d ? 'true' : 'false'} onClick=${() => set('survey.weeklyDay', d)}>${WEEKDAYS[d]}</button>`)}</div></span></div>
    </div>
  </section>`;
}

function Environment() {
  const s = state.repo.settings;
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [err, setErr] = useState(null);
  const set = (path, v) => saveSettings(setPath(s, path, v));
  const search = async () => {
    setErr(null);
    try {
      setResults(await searchPlace(q));
    } catch (e) {
      setErr(state.preview ? 'In der Vorschau sind externe Abfragen gesperrt; in der installierten App funktioniert die Ortssuche.' : 'Ortssuche nicht erreichbar. Prüfe die Internetverbindung.');
    }
  };
  const choose = async (p) => {
    await saveSettings(setPath(setPath(s, 'context.place', { name: p.name, region: p.region, lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 }), 'context.enabled', true));
    setResults(null);
    await load();
  };
  const load = async () => {
    setErr(null);
    try {
      const n = await refreshContext();
      toast(`${n} Tage Wetter und Luftqualität geladen`);
    } catch (e) {
      setErr(state.preview ? 'In der Vorschau sind externe Abfragen gesperrt; in der installierten App funktioniert das Laden.' : 'Wetterdaten nicht erreichbar. Prüfe die Internetverbindung.');
    }
  };
  const days = state.repo.context.size;
  return html`<section class="card">
    <div class="card-head"><h2>Umwelt</h2></div>
    <p class="small muted" style="margin-bottom:10px">Wetter, Feinstaub und Pollen für deinen Ort, als Faktoren in den Einsichten. Gesendet werden nur die gerundeten Koordinaten des Ortes an Open-Meteo.</p>
    ${s.context.place ? html`<div class="row between" style="margin-bottom:10px"><span><${Icon} name="location" size=${16} /> <b>${s.context.place.name}</b> <span class="muted small">${s.context.place.region}</span></span>
      <button class="btn small" onClick=${load}><${Icon} name="sync" size=${16} />Laden</button></div>` : null}
    <div class="row">
      <input class="field grow" type="search" placeholder="Ort suchen, z. B. Berlin" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} onKeyDown=${(e) => e.key === 'Enter' && search()} aria-label="Ort suchen" />
      <button class="btn small" disabled=${q.trim().length < 2} onClick=${search}>Suchen</button>
    </div>
    ${results ? html`<div class="list" style="margin-top:8px">${results.length ? results.map((p) => html`<button class="list-row" style="background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;color:inherit" onClick=${() => choose(p)}><span class="t">${p.name}</span><span></span><span class="d">${p.region}</span></button>`) : html`<p class="small muted">Nichts gefunden.</p>`}</div>` : null}
    ${err ? html`<p class="small" style="color:var(--crit);margin-top:8px">${err}</p>` : null}
    <p class="tiny muted" style="margin-top:10px">${days} Tage Umweltdaten gespeichert${state.repo.meta.lastContext ? `, zuletzt ${ago(state.repo.meta.lastContext)}` : ''}. Open-Meteo liefert bis zu 92 Tage rückwirkend; öffne die App also mindestens alle drei Monate. ${ATTRIBUTION}</p>
  </section>`;
}

function ModelParams() {
  const s = state.repo.settings;
  const groups = [...new Set(PARAMS.map((p) => p.group))];
  const set = async (path, raw, p) => {
    const n = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) return;
    const v = Math.min(p.max, Math.max(p.min, n));
    await saveSettings(setPath(s, path, v));
  };
  const reset = async () => {
    const next = clone(s);
    next.model = clone(DEFAULTS.model);
    next.analysis = clone(DEFAULTS.analysis);
    await saveSettings(next);
    toast('Modell zurückgesetzt');
  };
  return html`<details class="card more">
    <summary>Modell und Gewichte <${Icon} name="down" size=${18} /></summary>
    <p class="small muted" style="margin:8px 0">Startwerte aus dem Konzept. Fehlt ein Messwert, verteilt die App sein Gewicht auf die anderen. Alle Tage werden sofort neu berechnet.</p>
    ${groups.map((g) => html`<div style="margin-top:10px"><div class="eyebrow">${g}</div>
      ${PARAMS.filter((p) => p.group === g).map((p) => html`<label class="param"><span>${p.label}</span>
        <input class="field" type="number" inputmode="decimal" step=${p.step} min=${p.min} max=${p.max} value=${getPath(s, p.path)} onChange=${(e) => set(p.path, e.currentTarget.value, p)} /></label>`)}
    </div>`)}
    <button class="btn small" style="margin-top:12px" onClick=${reset}>Standard wiederherstellen</button>
  </details>`;
}

async function downloadJson(obj, name) {
  const text = JSON.stringify(obj);
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

function Backup() {
  const [raw, setRaw] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [asking, setAsking] = useState(false);
  const fileRef = useRef(null);
  const exportNow = async () => {
    try {
      const obj = await state.repo.exportBackup({ includeRaw: raw });
      await downloadJson(obj, `formkurve-backup-${state.today}.json`);
    } catch {
      toast('Download hier nicht möglich', 'error');
    }
  };
  const importNow = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try {
      update({ busy: 'Backup wird geladen …' });
      await state.repo.importBackup(JSON.parse(await f.text()));
      recompute();
      toast('Backup geladen');
    } catch (x) {
      toast(x.message || 'Backup ungültig', 'error');
    } finally {
      update({ busy: null });
    }
  };
  const wipe = async () => {
    await state.repo.clearAll();
    recompute();
    setAsking(false);
    setConfirm('');
    toast('Alle Daten gelöscht');
  };
  return html`<section class="card">
    <div class="card-head"><h2>Backup</h2></div>
    <p class="small muted" style="margin-bottom:10px">Deine Antworten aus den Checks gibt es nur hier. Messwerte lassen sich jederzeit neu aus Apple Health holen.</p>
    <div class="list">
      <div class="list-row"><span class="t">Messwerte einschließen</span><${Switch} id="raw" label="Messwerte einschließen" checked=${raw} onChange=${setRaw} /><span class="d">Macht die Datei deutlich größer.</span></div>
    </div>
    ${state.preview ? html`<p class="small muted" style="margin-top:8px">In der Vorschau sind Downloads gesperrt.</p>` : null}
    <div class="row wrap" style="margin-top:10px">
      <button class="btn small" disabled=${state.preview} onClick=${exportNow}><${Icon} name="import" size=${16} />Backup exportieren</button>
      <button class="btn small ghost" onClick=${() => fileRef.current?.click()}><${Icon} name="file" size=${16} />Backup laden</button>
      <input ref=${fileRef} type="file" accept=".json,application/json" hidden onChange=${importNow} />
    </div>
    <hr class="divider" />
    ${!asking ? html`<button class="btn small danger" onClick=${() => setAsking(true)}>Alle Daten löschen</button>` : html`<div class="confirm">
      <b>Wirklich alle ${state.demo ? 'Beispieldaten' : 'Daten'} löschen?</b>
      <p class="small ink2">Messwerte, Antworten, Umweltdaten und Einstellungen auf diesem Gerät. Tippe LÖSCHEN zur Bestätigung.</p>
      <input class="field" value=${confirm} onInput=${(e) => setConfirm(e.currentTarget.value)} aria-label="Bestätigung" autocomplete="off" />
      <div class="row"><button class="btn small danger" disabled=${confirm.trim().toUpperCase() !== 'LÖSCHEN'} onClick=${wipe}>Endgültig löschen</button><button class="btn small ghost" onClick=${() => { setAsking(false); setConfirm(''); }}>Abbrechen</button></div>
    </div>`}
  </section>`;
}

export function DataView() {
  const repo = state.repo;
  return html`
    <${Topbar} title="Daten" sub=${repo.index.lastSample ? `Letzte Messung ${ago(repo.index.lastSample)}` : 'Noch keine Messwerte'} />
    <main class="view">
      <${DemoBanner} />
      <section class="card stack">
        <div class="card-head" style="margin-bottom:0"><h2>Daten importieren</h2></div>
        ${state.preview ? html`<p class="small ink2">In dieser Vorschau laufen nur Beispieldaten. Deine echten Daten importierst du in der installierten App auf deinem iPhone; die Anleitung steht in der README.</p>` : html`
        <${PasteImport} />
        <hr class="divider" style="margin:4px 0" />
        <${ExportImport} />`}
        ${state.lastImport ? html`<hr class="divider" style="margin:4px 0" /><${ImportSummary} s=${state.lastImport} />` : null}
      </section>
      <${ShortcutGuide} />
      <${Diagnose} />
      <${Sources} />
      <${Profile} />
      <${Preferences} />
      <${Environment} />
      <${ModelParams} />
      <${Backup} />
      <section class="card stack">
        <div class="card-head" style="margin-bottom:0"><h2>Beispieldaten</h2></div>
        <p class="small muted">90 erfundene Tage mit eingebauten Effekten, getrennt von deinen Daten gespeichert.</p>
        ${state.demo ? html`<div class="row wrap">${state.preview ? null : html`<button class="btn small" onClick=${() => setDemo(false)}>Zu deinen Daten</button>`}<button class="btn small ghost" onClick=${resetDemo}>Neu erzeugen</button></div>`
          : html`<button class="btn small" onClick=${() => setDemo(true)}>Beispieldaten ansehen</button>`}
      </section>
      <section class="card stack small ink2">
        <div class="card-head" style="margin-bottom:0"><h2>Über Formkurve</h2><span class="tiny muted">Version 0.1</span></div>
        <p>Eine private Web-App: Alle Daten liegen in diesem Browser auf deinem iPhone${repo.persistent ? '' : ' (hier nur im Arbeitsspeicher, nach dem Schließen weg)'}. Kein Konto, kein Server.</p>
        <p>Die Scores sind eine eigene Heuristik und keine medizinische Bewertung. Bei Beschwerden zählt ärztlicher Rat, nicht die App.</p>
        <p class="tiny muted">Enthält Preact und htm (MIT) sowie fflate (MIT). ${ATTRIBUTION}</p>
      </section>
    </main>`;
}
