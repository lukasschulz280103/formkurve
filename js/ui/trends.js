// Ansicht "Verlauf": Tagesform, Recovery, Schlaf, Strain, Balance, HRV und Ruhepuls über die Zeit.
import { html, useState } from '../vendor/preact-htm.js';
import { state, openJournal } from './state.js';
import { Topbar, DemoBanner } from './today.js';
import { TimeChart, Legend, DataTable } from './charts.js';
import { Segmented } from './components.js';
import { Icon } from './icons.js';
import { InfoButton } from './info.js';
import { num } from './format.js';
import { ageOf } from '../core/config.js';

const lastOf = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
};

export const RANGES = [
  { value: 14, label: '14 T' },
  { value: 30, label: '30 T' },
  { value: 90, label: '90 T' },
  { value: 0, label: 'Alle' },
];

export function ChartCard({ id, title, sub, legend, children, table, info }) {
  const [showTable, setShowTable] = useState(false);
  return html`<section class="card" aria-labelledby=${`h-${id}`}>
    <div class="card-head">
      <div class="grow"><h2 id=${`h-${id}`} class="row" style="gap:4px">${title}${info ? html`<${InfoButton} k=${info.k} value=${info.value} extra=${info.extra || {}} label=${title} />` : null}</h2>${sub ? html`<div class="small muted">${sub}</div>` : null}</div>
      ${table ? html`<button class="btn small ghost" aria-pressed=${showTable ? 'true' : 'false'} onClick=${() => setShowTable(!showTable)}><${Icon} name="table" size=${16} />${showTable ? 'Diagramm' : 'Tabelle'}</button>` : null}
    </div>
    ${legend ? html`<${Legend} items=${legend} />` : null}
    ${showTable && table ? html`<${DataTable} dates=${table.dates} columns=${table.columns} />` : children}
  </section>`;
}

export function TrendsView() {
  const [range, setRange] = useState(30);
  const settings = state.repo.settings;
  const all = state.results.dates;
  const dates = range ? all.slice(-range) : all;
  const days = dates.map((d) => state.results.days.get(d));
  const pick = (f) => days.map((d) => {
    const v = d ? f(d) : null;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  });
  const { red, green } = settings.model.recovery;
  const recColor = (v) => (v < red ? 'var(--crit)' : v >= green ? 'var(--good)' : 'var(--warn)');
  const has = (arr) => arr.some((v) => v != null);

  const form = pick((d) => d.form);
  const fit = pick((d) => d.fitness);
  const rec = pick((d) => d.recovery);
  const sleepH = pick((d) => (d.sleep ? d.sleep.asleepMin / 60 : null));
  const needH = pick((d) => (d.sleep ? d.sleepNeedH : null));
  const strain = pick((d) => d.strain);
  const acwr = pick((d) => d.acwr);
  const hrv = pick((d) => d.hrv);
  const scale = (b, floor) => Math.max(1.4826 * (b?.mad || 0), floor);
  const hrvLo = pick((d) => (d.base?.lnHrv ? Math.exp(d.base.lnHrv.median - scale(d.base.lnHrv, 0.06)) : null));
  const hrvHi = pick((d) => (d.base?.lnHrv ? Math.exp(d.base.lnHrv.median + scale(d.base.lnHrv, 0.06)) : null));
  const rhr = pick((d) => d.rhr);
  const rhrLo = pick((d) => (d.base?.rhr ? d.base.rhr.median - scale(d.base.rhr, 1.5) : null));
  const rhrHi = pick((d) => (d.base?.rhr ? d.base.rhr.median + scale(d.base.rhr, 1.5) : null));
  const resp = pick((d) => d.resp);
  const steps = pick((d) => d.steps);
  const nightT = pick((d) => d.context?.nightTempMin);
  // Linie für Tropennächte nur zeigen, wenn die Nächte überhaupt in die Nähe kommen
  const warmNights = nightT.some((x) => x != null && x >= 14);
  const pm25 = pick((d) => d.context?.pm25);
  const spo2 = pick((d) => d.spo2);
  const f0 = (v) => num(v);
  const f1 = (v) => num(v, 1);
  const f2 = (v) => num(v, 2);

  if (!all.length) {
    return html`<${Topbar} title="Verlauf" /><main class="view"><${DemoBanner} /><section class="card"><p class="muted">Noch keine Daten. Importiere zuerst deine Messwerte.</p></section></main>`;
  }

  return html`
    <${Topbar} title="Verlauf" sub=${`${dates.length} Tage`} />
    <main class="view">
      <${DemoBanner} />
      <${Segmented} label="Zeitraum" options=${RANGES} value=${range} onChange=${setRange} />
      <p class="tiny muted" style="margin:-4px 2px 0"><i class="weekend-key" aria-hidden="true"></i>Hinterlegt: Wochenende (Sa, So). Nachtwerte zählen zum Tag des Aufwachens.</p>
      <${ChartCard} id="form" info=${{ k: 'form', value: lastOf(form) }} title="Tagesform und Langzeit-Fitness" sub="Tagesform reagiert in Tagen, Fitness in Wochen"
        legend=${[{ label: 'Tagesform', color: 'var(--ink)' }, { label: 'Langzeit-Fitness', color: 'var(--muted)' }]}
        table=${{ dates, columns: [{ label: 'Tagesform', values: form, fmt: f0 }, { label: 'Fitness', values: fit, fmt: f0 }] }}>
        <${TimeChart} label="Tagesform und Langzeit-Fitness" dates=${dates} yDomain=${[0, 100]} yTicks=${[0, red, green, 100]}
          series=${[{ key: 'form', label: 'Tagesform', values: form, color: 'var(--ink)' }, { key: 'fit', label: 'Langzeit-Fitness', values: fit, color: 'var(--muted)', strong: false }]} fmt=${f0} />
      <//>
      <${ChartCard} id="rec" info=${{ k: 'recovery', value: lastOf(rec) }} title="Recovery" sub=${`rot unter ${red}, grün ab ${green}`}
        legend=${[{ label: 'gut', color: 'var(--good)', box: true }, { label: 'mittel', color: 'var(--warn)', box: true }, { label: 'niedrig', color: 'var(--crit)', box: true }]}
        table=${{ dates, columns: [{ label: 'Recovery', values: rec, fmt: f0 }] }}>
        <${TimeChart} label="Recovery je Tag" dates=${dates} yDomain=${[0, 100]} yTicks=${[0, red, green, 100]}
          series=${[{ key: 'rec', label: 'Recovery', values: rec, type: 'bar', color: 'var(--ink-2)', colorFn: recColor }]} fmt=${f0} />
      <//>
      ${has(sleepH) ? html`<${ChartCard} id="sleep" info=${{ k: 'asleep', value: lastOf(sleepH) != null ? lastOf(sleepH) * 60 : null }} title="Schlaf" sub="Geschlafene Stunden gegen deinen Schlafbedarf"
        legend=${[{ label: 'geschlafen', color: 'var(--sleep)', box: true }, { label: 'Bedarf', color: 'var(--ink-2)' }]}
        table=${{ dates, columns: [{ label: 'Schlaf h', values: sleepH, fmt: f1 }, { label: 'Bedarf h', values: needH, fmt: f1 }, { label: 'Score', values: pick((d) => d.sleepScore), fmt: f0 }] }}>
        <${TimeChart} label="Schlafdauer und Schlafbedarf" dates=${dates} yDomain=${[0, 10]} yTicks=${[0, 4, 6, 8, 10]}
          series=${[{ key: 'sl', label: 'geschlafen', values: sleepH, type: 'bar', color: 'var(--sleep)' }, { key: 'need', label: 'Bedarf', values: needH, color: 'var(--ink-2)', strong: false }]} fmt=${f1} tickFmt=${f0} endLabel=${false} />
      <//>` : null}
      ${has(strain) ? html`<${ChartCard} id="strain" info=${{ k: 'strain', value: lastOf(strain) }} title="Strain" sub="Belastung des Tages, 0 bis 100"
        table=${{ dates, columns: [{ label: 'Strain', values: strain, fmt: f0 }, { label: 'Last', values: pick((d) => d.load), fmt: f0 }] }}>
        <${TimeChart} label="Strain je Tag" dates=${dates} yDomain=${[0, 100]} yTicks=${[0, 25, 50, 75, 100]}
          series=${[{ key: 'st', label: 'Strain', values: strain, type: 'bar', color: 'var(--strain)' }]} fmt=${f0} />
      <//>` : null}
      ${has(acwr) ? html`<${ChartCard} id="acwr" info=${{ k: 'acwr', value: lastOf(acwr) }} title="Belastungsbalance" sub="Letzte 7 Tage im Verhältnis zu 28 Tagen; Band = 0,8 bis 1,3"
        table=${{ dates, columns: [{ label: '7 zu 28', values: acwr, fmt: f2 }, { label: 'Balance', values: pick((d) => d.balance), fmt: f0 }] }}>
        <${TimeChart} label="Verhältnis akute zu chronischer Last" dates=${dates} yDomain=${[0, 2]} yTicks=${[0, 0.8, 1.3, 2]}
          band=${{ lo: dates.map(() => settings.model.balance.lo), hi: dates.map(() => settings.model.balance.hi), label: 'Zielbereich' }}
          series=${[{ key: 'acwr', label: '7 zu 28 Tage', values: acwr, color: 'var(--strain)' }]} fmt=${f2} />
      <//>` : null}
      ${has(hrv) ? html`<${ChartCard} id="hrv" info=${{ k: 'hrv', value: lastOf(hrv) }} title="HRV" sub="Nachtwert in ms; Band = dein Normalbereich der letzten 28 Tage"
        table=${{ dates, columns: [{ label: 'HRV ms', values: hrv, fmt: f0 }, { label: 'normal von', values: hrvLo, fmt: f0 }, { label: 'bis', values: hrvHi, fmt: f0 }] }}>
        <${TimeChart} label="HRV mit Normalbereich" dates=${dates} band=${{ lo: hrvLo, hi: hrvHi, label: 'normal' }}
          series=${[{ key: 'hrv', label: 'HRV', values: hrv, color: 'var(--ink)' }]} fmt=${f0} />
      <//>` : null}
      ${has(rhr) ? html`<${ChartCard} id="rhr" info=${{ k: 'rhr', value: lastOf(rhr) }} title="Ruhepuls" sub="Im Schlaf gemessen; Band = dein Normalbereich"
        table=${{ dates, columns: [{ label: 'Ruhepuls', values: rhr, fmt: f0 }, { label: 'normal von', values: rhrLo, fmt: f0 }, { label: 'bis', values: rhrHi, fmt: f0 }] }}>
        <${TimeChart} label="Ruhepuls mit Normalbereich" dates=${dates} band=${{ lo: rhrLo, hi: rhrHi, label: 'normal' }}
          series=${[{ key: 'rhr', label: 'Ruhepuls', values: rhr, color: 'var(--ink)' }]} fmt=${f0} />
      <//>` : null}
      ${has(resp) ? html`<${ChartCard} id="resp" info=${{ k: 'resp', value: lastOf(resp) }} title="Atemfrequenz" sub="Atemzüge pro Minute im Schlaf"
        table=${{ dates, columns: [{ label: 'Atemfrequenz', values: resp, fmt: f1 }] }}>
        <${TimeChart} label="Atemfrequenz" dates=${dates} series=${[{ key: 'resp', label: 'Atemfrequenz', values: resp, color: 'var(--ink)' }]} fmt=${f1} tickFmt=${f0} />
      <//>` : null}
      ${has(spo2) ? html`<${ChartCard} id="spo2" info=${{ k: 'spo2', value: lastOf(spo2) }} title="Blutsauerstoff" sub="Mittelwert im Schlaf in Prozent"
        table=${{ dates, columns: [{ label: 'SpO₂ %', values: spo2, fmt: f1 }] }}>
        <${TimeChart} label="Blutsauerstoff" dates=${dates} series=${[{ key: 'spo2', label: 'SpO₂', values: spo2, color: 'var(--ink)' }]} fmt=${f1} />
      <//>` : null}
      ${has(steps) ? html`<${ChartCard} id="steps" info=${{ k: 'steps', value: lastOf(steps) }} title="Schritte" sub=${ageOf(settings) == null ? 'Je Tag; Linie = 8.000 (ab 60 Jahren 6.000)' : `Je Tag; Linie = ${ageOf(settings) >= 60 ? '6.000' : '8.000'}, Richtwert für dein Alter`}
        table=${{ dates, columns: [{ label: 'Schritte', values: steps, fmt: f0 }] }}>
        <${TimeChart} label="Schritte je Tag" dates=${dates} yTicks=${null} refLines=${[{ y: (ageOf(settings) ?? 0) >= 60 ? 6000 : 8000 }]}
          series=${[{ key: 'steps', label: 'Schritte', values: steps, type: 'bar', color: 'var(--ink-2)' }]} fmt=${(v) => (v >= 1000 ? `${num(v / 1000, 1)} T` : num(v))} tickFmt=${(v) => (v >= 1000 ? `${num(v / 1000)} T` : num(v))} yDomain=${[0, Math.max(10000, ...steps.filter((x) => x != null)) * 1.05]} />
      <//>` : null}
      ${has(nightT) ? html`<${ChartCard} id="nightT" info=${{ k: 'nightTemp', value: lastOf(nightT) }} title="Nachttemperatur" sub=${warmNights ? 'Tiefstwert draußen; Linie = Tropennacht (20 °C)' : 'Tiefstwert draußen in der Nacht'}
        table=${{ dates, columns: [{ label: 'Nacht °C', values: nightT, fmt: f1 }] }}>
        <${TimeChart} label="Nachttemperatur" dates=${dates} refLines=${warmNights ? [{ y: 20 }] : []} series=${[{ key: 'nt', label: 'Nacht, Tiefstwert', values: nightT, color: 'var(--ink)' }]} fmt=${f1} tickFmt=${f0} />
      <//>` : null}
      ${has(pm25) ? html`<${ChartCard} id="pm25" info=${{ k: 'pm25', value: lastOf(pm25) }} title="Feinstaub PM2,5" sub="Tagesmittel; Linie = WHO-Richtwert 15 µg/m³"
        table=${{ dates, columns: [{ label: 'PM2,5', values: pm25, fmt: f1 }] }}>
        <${TimeChart} label="Feinstaub PM2,5" dates=${dates} refLines=${[{ y: 15 }]} yDomain=${[0, Math.max(20, ...pm25.filter((x) => x != null)) * 1.1]} series=${[{ key: 'pm', label: 'PM2,5', values: pm25, color: 'var(--ink)' }]} fmt=${f1} tickFmt=${f0} />
      <//>` : null}
      ${state.repo.journal.size ? html`<section class="card row between" style="gap:12px">
        <div class="grow"><h3>Logbuch</h3><p class="small muted">Wasser, Koffein, Glück, Sport und Arbeit im Verlauf.</p></div>
        <button class="btn small" onClick=${() => openJournal(null, 'rueckblick')}><${Icon} name="book" size=${16} />Rückblick</button>
      </section>` : null}
    </main>`;
}
