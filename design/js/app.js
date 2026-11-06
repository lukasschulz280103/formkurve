// Oberfläche der Design-Variante: Zusammenfassung mit verschiebbaren Kacheln,
// Bearbeiten-Modus und Detailblatt. Preact mit htm, kein Build-Schritt nötig.
import { html, useState, useEffect, useRef, useLayoutEffect, useMemo } from '../../js/vendor/preact-htm.js';
import { isNum } from '../../js/core/stats.js';
import { addDays } from '../../js/core/time.js';
import { DESIGN_VERSION, CORE_VERSION } from '../version.js';
import { TILES, TILE, GROUPS, seriesOf, latest, weekDelta } from './tiles.js';
import { loadLayout, saveLayout, DEFAULT_LAYOUT } from './layout.js';
import { Line, Bars, Ring, Detail } from './charts.js';

const WEEKDAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTH = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function toDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const longDate = (key) => {
  const d = toDate(key);
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()}. ${MONTH[d.getMonth()]}`;
};
const shortDate = (key) => {
  const d = toDate(key);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
};
const ageText = (age) => (age === 0 ? null : age === 1 ? 'Gestern' : `vor ${age} Tagen`);
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Chevron() {
  return html`<svg class="chev" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

/** Eine Kachel: Gruppe, Name, Wert und ein kleines Diagramm. */
function Tile({ item, results, today, editing, onOpen, onRemove, onResize, onKey }) {
  const t = TILE[item.id];
  const { value, age } = latest(t, results, today);
  const days = item.size === 'gross' ? 30 : 14;
  const series = useMemo(() => seriesOf(t, results, today, days), [item.id, days, results, today]);
  const color = GROUPS[t.group].color;
  const d = results.days.get(today);
  const sub = t.sub?.(d) || null;
  const chart = t.chart === 'ring'
    ? html`<${Ring} value=${value} color=${color} size=${item.size === 'gross' ? 68 : 54} />`
    : t.chart === 'bars'
      ? html`<${Bars} values=${series} color=${color} height=${item.size === 'gross' ? 56 : 38} />`
      : html`<${Line} values=${series} color=${color} height=${item.size === 'gross' ? 56 : 38} />`;
  const ring = t.chart === 'ring';
  return html`<div class=${`tile ${item.size}${ring ? ' has-ring' : ''}`} data-tile=${item.id}>
    <button type="button" class="tile-body" aria-disabled=${editing ? 'true' : null} onClick=${() => !editing && onOpen(item.id)}
      aria-label=${`${t.label}: ${value == null ? 'kein Wert' : `${t.fmt(value)} ${t.unit}`}`}>
      <span class="tile-top">
        <span class="cat" style=${`color:${color}`}>${GROUPS[t.group].label}</span>
        ${editing ? null : html`<${Chevron} />`}
      </span>
      <span class="tile-name">${t.label}</span>
      <span class="tile-main">
        <span class="tile-figure">
          <span class="tile-value">${value == null ? '–' : t.fmt(value)}${t.unit ? html` <i>${t.unit}</i>` : null}</span>
          ${sub || ageText(age) ? html`<span class="tile-sub">${[sub, ageText(age)].filter(Boolean).join(' · ')}</span>` : null}
        </span>
        ${ring ? chart : null}
      </span>
      ${ring
        ? (item.size === 'gross' ? html`<span class="tile-chart"><${Line} values=${series} color=${color} height=${44} /></span>` : null)
        : html`<span class="tile-chart">${chart}</span>`}
    </button>
    ${editing ? html`
      <button type="button" class="tile-x" onClick=${() => onRemove(item.id)} aria-label=${`${t.label} aus den Favoriten nehmen`}>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="tile-size" onClick=${() => onResize(item.id)} aria-label=${`${t.label} ${item.size === 'gross' ? 'schmal' : 'breit'} machen`}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d=${item.size === 'gross' ? 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7' : 'M4 10V4h6M20 14v6h-6M4 4l7 7M20 20l-7-7'} fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <button type="button" class="tile-grab" aria-label=${`${t.label} verschieben. Mit den Pfeiltasten umsortieren.`} onKeyDown=${(e) => onKey(e, item.id)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h16M4 15h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
      </button>` : null}
  </div>`;
}

/** Höhepunkte: Woche gegen Vorwoche, nur wo der Unterschied auffällt. */
function Highlights({ results, today, onOpen }) {
  const cards = [];
  for (const t of TILES) {
    if (cards.length >= 4) break;
    const w = weekDelta(t, results, today);
    if (!w) continue;
    const rel = Math.abs(w.diff) / (Math.abs(w.before) || 1);
    if (rel < 0.04) continue;
    const better = ['rhr', 'strain'].includes(t.id) ? w.diff < 0 : w.diff > 0;
    cards.push({ t, w, better });
  }
  if (!cards.length) return null;
  return html`<section class="section" aria-labelledby="h-high">
    <h2 class="sec-head" id="h-high">Höhepunkte</h2>
    <div class="rail">
      ${cards.map(({ t, w, better }) => html`<button type="button" class="hl" key=${t.id} onClick=${() => onOpen(t.id)}>
        <span class="cat" style=${`color:${GROUPS[t.group].color}`}>${t.label}</span>
        <span class="hl-text">${better ? 'Besser' : 'Schwächer'} als letzte Woche</span>
        <span class="hl-num" style=${`color:${GROUPS[t.group].color}`}>${t.fmt(w.now)}<i> ${t.unit || ''}</i></span>
        <span class="hl-sub">${w.diff > 0 ? '+' : '−'}${t.fmt(Math.abs(w.diff))} zur Vorwoche</span>
      </button>`)}
    </div>
  </section>`;
}

const RANGES = [{ n: 7, label: '7 Tage' }, { n: 30, label: '30 Tage' }, { n: 90, label: '90 Tage' }];

/** Detailblatt zu einer Kachel. */
function Sheet({ id, results, today, onClose, onToggleFav, isFav }) {
  const [range, setRange] = useState(30);
  const ref = useRef(null);
  const t = TILE[id];
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, [id]);
  const values = seriesOf(t, results, today, range);
  const labels = [shortDate(addDays(today, -(range - 1))), shortDate(today)];
  const nums = values.filter(isNum);
  const { value, age } = latest(t, results, today);
  const color = GROUPS[t.group].color;
  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex="-1" ref=${ref}>
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head">
        <div>
          <span class="cat" style=${`color:${color}`}>${GROUPS[t.group].label}</span>
          <h2 id="sheet-title">${t.label}</h2>
        </div>
        <button type="button" class="round" onClick=${onClose} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
        </button>
      </div>
      <div class="sheet-value" style=${`color:${color}`}>
        ${value == null ? '–' : t.fmt(value)}<i> ${t.unit}</i>
        ${ageText(age) ? html`<span class="tile-sub"> · ${ageText(age)}</span>` : null}
      </div>
      <div class="seg" role="group" aria-label="Zeitraum">
        ${RANGES.map((r) => html`<button type="button" key=${r.n} aria-pressed=${range === r.n ? 'true' : 'false'} onClick=${() => setRange(r.n)}>${r.label}</button>`)}
      </div>
      <${Detail} values=${values} labels=${labels} color=${color} kind=${t.chart === 'bars' ? 'bars' : 'line'} />
      ${nums.length ? html`<dl class="stats">
        <div><dt>Durchschnitt</dt><dd>${t.fmt(nums.reduce((s, x) => s + x, 0) / nums.length)}</dd></div>
        <div><dt>Höchster</dt><dd>${t.fmt(Math.max(...nums))}</dd></div>
        <div><dt>Niedrigster</dt><dd>${t.fmt(Math.min(...nums))}</dd></div>
        <div><dt>Tage mit Wert</dt><dd>${nums.length} von ${range}</dd></div>
      </dl>` : null}
      <p class="about">${t.about}</p>
      <button type="button" class="btn" onClick=${() => onToggleFav(id)}>${isFav ? 'Aus den Favoriten nehmen' : 'Zu den Favoriten'}</button>
    </div>
  </div>`;
}

export function App({ results, today }) {
  const [layout, setLayout] = useState(loadLayout);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [said, setSaid] = useState('');
  const [small, setSmall] = useState(false);
  const gridRef = useRef(null);
  const flip = useRef(null);
  const slots = useRef(new Map());
  const drag = useRef(null);

  useEffect(() => saveLayout(layout), [layout]);
  useEffect(() => {
    const onScroll = () => setSmall(window.scrollY > 52);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('no-scroll', Boolean(open));
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  // Plätze der Kacheln ohne laufende Animation. Danach richtet sich, über welchem Platz
  // der Finger gerade schwebt; die sichtbaren Rechtecke taugen dafür nicht, solange etwas gleitet.
  const snapSlots = (grid) => {
    const m = new Map();
    for (const el of grid.querySelectorAll('[data-tile]')) m.set(el.dataset.tile, el.getBoundingClientRect());
    slots.current = m;
  };
  // Vor einer Umsortierung die alten Plätze merken, danach von dort zurückgleiten lassen (FLIP).
  const measure = () => {
    if (reduced() || !gridRef.current) return;
    flip.current = slots.current;
  };
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const d = drag.current;
    const before = flip.current;
    flip.current = null;
    if (!before && !d) return;
    const next = new Map();
    for (const el of grid.querySelectorAll('[data-tile]')) {
      const id = el.dataset.tile;
      if (d && id === d.id) {
        // Die gezogene Kachel folgt dem Finger: Grundposition ohne Verschiebung messen
        el.style.transform = 'none';
        const r = el.getBoundingClientRect();
        d.left = r.left;
        d.top = r.top;
        el.style.transform = `translate(${(d.x - d.grabX - r.left).toFixed(1)}px, ${(d.y - d.grabY - r.top).toFixed(1)}px)`;
        next.set(id, r);
        continue;
      }
      // Läuft noch ein Gleiten, von der sichtbaren Stelle aus weitermachen statt zu springen
      const running = el.getAnimations();
      let seen = null;
      if (running.length) {
        seen = el.getBoundingClientRect();
        for (const an of running) an.cancel();
      }
      const b = el.getBoundingClientRect();
      next.set(id, b);
      const a = seen || before?.get(id);
      if (!a) continue;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.25,1)' });
    }
    slots.current = next;
  });

  const move = (id, to) => {
    setLayout((list) => {
      const from = list.findIndex((x) => x.id === id);
      const t = Math.max(0, Math.min(list.length - 1, to));
      if (from < 0 || from === t) return list;
      const next = list.slice();
      next.splice(t, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const onPointerDown = (e) => {
    if (!editing || e.button > 0) return;
    // Die Knöpfe auf der Kachel bleiben Knöpfe: kein Ziehen, damit ihr Klick ankommt
    if (e.target.closest?.('.tile-x, .tile-size, .tile-grab')) return;
    const el = e.target.closest?.('[data-tile]');
    if (!el || !gridRef.current?.contains(el)) return;
    snapSlots(gridRef.current);
    const r = slots.current.get(el.dataset.tile) || el.getBoundingClientRect();
    drag.current = { id: el.dataset.tile, pointerId: e.pointerId, grabX: e.clientX - r.left, grabY: e.clientY - r.top, left: r.left, top: r.top, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    const el = gridRef.current?.querySelector(`[data-tile="${d.id}"]`);
    if (!el) return;
    if (!d.moved) {
      // Erst ab ein paar Pixeln wird daraus ein Zug; bis dahin bleibt es ein Tippen
      if (Math.abs(e.clientX - (d.left + d.grabX)) + Math.abs(e.clientY - (d.top + d.grabY)) < 5) return;
      d.moved = true;
      el.setPointerCapture?.(d.pointerId);
      setDragId(d.id);
    }
    el.style.transform = `translate(${(d.x - d.grabX - d.left).toFixed(1)}px, ${(d.y - d.grabY - d.top).toFixed(1)}px)`;
    // Über welchem Platz schwebt der Finger?
    for (const [id, r] of slots.current) {
      if (id === d.id) continue;
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const to = layout.findIndex((x) => x.id === id);
        if (to >= 0) {
          measure();
          move(d.id, to);
        }
        break;
      }
    }
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    const el = gridRef.current?.querySelector(`[data-tile="${d.id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.transform = '';
      if (!reduced() && d.moved) {
        const n = el.getBoundingClientRect();
        el.animate([{ transform: `translate(${r.left - n.left}px, ${r.top - n.top}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.25,1)' });
      }
    }
    drag.current = null;
    setDragId(null);
  };

  const onKey = (e, id) => {
    const i = layout.findIndex((x) => x.id === id);
    const to = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : null;
    if (to == null || to < 0 || to >= layout.length) return;
    e.preventDefault();
    measure();
    move(id, to);
    setSaid(`${TILE[id].label} an Stelle ${to + 1} von ${layout.length}`);
  };

  const remove = (id) => {
    measure();
    setLayout((l) => l.filter((x) => x.id !== id));
    setSaid(`${TILE[id].label} entfernt`);
  };
  const add = (id) => {
    measure();
    setLayout((l) => [...l, { id, size: 'klein' }]);
    setSaid(`${TILE[id].label} hinzugefügt`);
  };
  const resize = (id) => {
    measure();
    setLayout((l) => l.map((x) => (x.id === id ? { ...x, size: x.size === 'gross' ? 'klein' : 'gross' } : x)));
  };
  const toggleFav = (id) => {
    if (layout.some((x) => x.id === id)) remove(id);
    else add(id);
  };

  const rest = TILES.filter((t) => !layout.some((x) => x.id === t.id));
  const d = results.days.get(today);

  return html`<div class=${`app${editing ? ' editing' : ''}`}>
    <header class=${`nav${small ? ' small' : ''}`}>
      <div class="bar">
        <span class="nav-title">Zusammenfassung</span>
        <div class="nav-right">
          <button type="button" class=${`link${editing ? ' strong' : ''}`} onClick=${() => { setEditing((v) => !v); setSaid(editing ? 'Bearbeiten beendet' : 'Bearbeiten. Kacheln lassen sich verschieben.'); }}>
            ${editing ? 'Fertig' : 'Bearbeiten'}
          </button>
          <span class="avatar" aria-hidden="true">LS</span>
        </div>
      </div>
    </header>
    <main class="wrap">
      <div class="title">
        <h1>Zusammenfassung</h1>
        <p class="date">${longDate(today)} <span class="chip">Beispieldaten</span></p>
      </div>
      ${editing ? html`<p class="hinweis">Kachel ziehen, um sie zu verschieben. <b>−</b> nimmt sie heraus, der Pfeil-Knopf macht sie breit oder schmal.</p>` : null}
      ${!editing && d ? html`<${Highlights} results=${results} today=${today} onOpen=${setOpen} />` : null}
      <section class="section" aria-labelledby="h-fav">
        <h2 class="sec-head" id="h-fav">Favoriten</h2>
        <div class="grid" ref=${gridRef} onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${endDrag} onPointerCancel=${endDrag}>
          ${layout.map((item) => html`<${Tile} key=${item.id} item=${item} results=${results} today=${today}
            editing=${editing} onOpen=${setOpen} onRemove=${remove} onResize=${resize} onKey=${onKey} />`)}
        </div>
        ${!layout.length ? html`<p class="leer">Keine Favoriten. Unten auswählen, was dich interessiert.</p>` : null}
      </section>
      ${editing && rest.length ? html`<section class="section" aria-labelledby="h-add">
        <h2 class="sec-head" id="h-add">Weitere Werte</h2>
        <ul class="addlist">
          ${rest.map((t) => html`<li key=${t.id}>
            <button type="button" onClick=${() => add(t.id)}>
              <span class="plus" aria-hidden="true">+</span>
              <span class="grow"><b>${t.label}</b><span class="cat" style=${`color:${GROUPS[t.group].color}`}>${GROUPS[t.group].label}</span></span>
              <span class="now">${(() => { const v = latest(t, results, today).value; return v == null ? '–' : `${t.fmt(v)} ${t.unit}`; })()}</span>
            </button>
          </li>`)}
        </ul>
      </section>` : null}
      ${editing ? html`<button type="button" class="btn ghost reset" onClick=${() => { measure(); setLayout(DEFAULT_LAYOUT.map((x) => ({ ...x }))); setSaid('Standardauswahl wiederhergestellt'); }}>Auf Standard zurücksetzen</button>` : null}
      <footer>
        <p><b>Formkurve Design ${DESIGN_VERSION}</b> · Entwurf im Stil von Apple Health, parallel zur App ${CORE_VERSION}.</p>
        <p>Alle Werte sind erfunden. Dieselben Formeln wie in der App, nur ohne Datenbank, Import und Konto.</p>
      </footer>
    </main>
    <p class="sr" role="status" aria-live="polite">${said}</p>
    ${open ? html`<${Sheet} id=${open} results=${results} today=${today} onClose=${() => setOpen(null)}
      isFav=${layout.some((x) => x.id === open)} onToggleFav=${toggleFav} />` : null}
    ${dragId ? html`<style>[data-tile="${dragId}"]{z-index:5}[data-tile="${dragId}"] .tile-body{animation:none;transform:scale(1.03);box-shadow:0 18px 36px -12px rgba(190,30,60,.38);cursor:grabbing}</style>` : null}
  </div>`;
}
