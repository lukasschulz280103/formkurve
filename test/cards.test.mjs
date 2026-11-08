import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_CARDS, cardOn, withCard, emptyCards } from '../js/ui/cards.js';
import { mergeSettings, DEFAULTS } from '../js/core/config.js';

test('Karten sind sichtbar, bis man sie ausblendet', () => {
  const s = mergeSettings();
  for (const c of HOME_CARDS) assert.equal(cardOn(s, c.id), true);
  const aus = withCard(s, 'night', false);
  assert.equal(cardOn(aus, 'night'), false);
  assert.equal(cardOn(aus, 'sleep'), true, 'andere Karten bleiben unberührt');
  assert.equal(cardOn(withCard(aus, 'night', true), 'night'), true);
  // Eine Karte, die es noch nicht gibt, gilt als sichtbar
  assert.equal(cardOn(s, 'gibtesnicht'), true);
});

test('Ausgeblendete Karten überleben das Zusammenführen der Einstellungen', () => {
  const gespeichert = { display: { cards: { night: false }, theme: 'light' } };
  const s = mergeSettings(gespeichert);
  assert.equal(cardOn(s, 'night'), false);
  assert.equal(cardOn(s, 'load'), true);
  assert.equal(s.display.palette, 'rot', 'die neue Farbvariante kommt als Standard dazu');
  assert.equal(s.display.theme, 'light');
});

test('Farbvariante: rot als Standard, schiefer weiter wählbar', () => {
  assert.equal(DEFAULTS.display.palette, 'rot');
  assert.equal(mergeSettings({ display: { palette: 'schiefer' } }).display.palette, 'schiefer');
});

test('Karten ohne Daten erkennt die App aus dem Datenbericht', () => {
  const row = (type, status) => ({ type, status });
  const alles = { rows: ['hrv', 'hr', 'rhr', 'resp', 'spo2', 'wtemp', 'sleep', 'steps', 'energy'].map((t) => row(t, 'ok')) };
  assert.deepEqual(emptyCards(alles), []);
  // Ohne Schlafanalyse bietet sich die Schlafkarte zum Ausblenden an
  const ohneSchlaf = { rows: alles.rows.map((r) => (r.type === 'sleep' ? row('sleep', 'none') : r)) };
  assert.deepEqual(emptyCards(ohneSchlaf), ['sleep']);
  // Fehlen alle Nachtwerte, auch die Karte „Letzte Nacht“ – Belastung lebt noch von Schritten
  const ohneNacht = { rows: alles.rows.map((r) => (['hrv', 'hr', 'rhr', 'resp', 'spo2', 'wtemp'].includes(r.type) ? row(r.type, 'none') : r)) };
  assert.deepEqual(emptyCards(ohneNacht).sort(), ['detect', 'night'], 'ohne Puls fragt auch die Erkennung nichts mehr');
  const ohneAlles = { rows: alles.rows.map((r) => row(r.type, 'none')) };
  assert.deepEqual(emptyCards(ohneAlles).sort(), ['detect', 'load', 'night', 'sleep']);
  // Ein einziger vorhandener Wert reicht, damit die Karte etwas zeigt
  const nurPuls = { rows: alles.rows.map((r) => (r.type === 'hr' ? row('hr', 'ok') : row(r.type, 'none'))) };
  assert.ok(!emptyCards(nurPuls).includes('night'));
  assert.ok(!emptyCards(nurPuls).includes('load'));
  assert.ok(!emptyCards(nurPuls).includes('detect'), 'die Erkennung braucht nur den Puls');
  // Ohne Bericht gibt es keine Empfehlung
  assert.deepEqual(emptyCards(null), []);
  // Karten ohne Messwerte stehen nie auf der Liste
  for (const id of ['rings', 'periods', 'contrib', 'hints', 'environment']) {
    assert.ok(!emptyCards(ohneNacht).includes(id), id);
  }
});
