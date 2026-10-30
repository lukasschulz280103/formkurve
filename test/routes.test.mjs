import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, PROFILE_PAGES } from '../js/ui/state.js';

test('Navigation: Reiter und Unterseiten im Profil', () => {
  assert.deepEqual(parseRoute('#heute'), { route: 'heute', sub: null });
  assert.deepEqual(parseRoute('#logbuch'), { route: 'logbuch', sub: null });
  assert.deepEqual(parseRoute('#verlauf'), { route: 'verlauf', sub: null });
  assert.deepEqual(parseRoute('#profil'), { route: 'profil', sub: null });
  for (const p of PROFILE_PAGES) assert.deepEqual(parseRoute(`#profil/${p}`), { route: 'profil', sub: p });
  // Unbekanntes führt auf die Übersicht oder „Heute“, nie ins Leere
  assert.deepEqual(parseRoute('#profil/gibtsnicht'), { route: 'profil', sub: null });
  assert.deepEqual(parseRoute('#heute/konto'), { route: 'heute', sub: null });
  assert.deepEqual(parseRoute('#unsinn'), { route: 'heute', sub: null });
  assert.deepEqual(parseRoute(''), { route: 'heute', sub: null });
  assert.deepEqual(parseRoute(null), { route: 'heute', sub: null });
});

test('Navigation: Links auf die Reiter bis 0.5 landen an der neuen Stelle', () => {
  assert.deepEqual(parseRoute('#einsichten'), { route: 'profil', sub: 'einsichten' });
  assert.deepEqual(parseRoute('#daten'), { route: 'profil', sub: null });
  // Der Check-in ist jetzt ein Blatt über jedem Reiter
  assert.deepEqual(parseRoute('#check'), { route: 'heute', sub: null });
});
