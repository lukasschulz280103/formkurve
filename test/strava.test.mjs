import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStravaCsv, looksLikeStrava, stravaSport, csvRow } from '../js/import/strava.js';
import { distanceKm } from '../js/data/normalize.js';

const HEAD = 'Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Max Heart Rate,Moving Time,Calories,Average Heart Rate';
const csv = (...rows) => [HEAD, ...rows].join('\n');

test('Strava: Kopfzeile wird erkannt, andere Formate nicht', () => {
  assert.equal(looksLikeStrava(csv()), true);
  assert.equal(looksLikeStrava('Herzfrequenz;2026-11-08T03:00;...;54;count/min;Zepp'), false);
  assert.equal(looksLikeStrava(''), false);
  // Deutsche Ausgabe
  assert.equal(looksLikeStrava('Aktivitäts-ID,Datum der Aktivität,Name der Aktivität,Art der Aktivität'), true);
});

test('Strava: Zeilen mit Kommas im Namen bleiben heil', () => {
  assert.deepEqual(csvRow('1,"Lauf, abends",Run'), ['1', 'Lauf, abends', 'Run']);
  assert.deepEqual(csvRow('1,"Er sagte ""hi""",Run'), ['1', 'Er sagte "hi"', 'Run']);
});

test('Strava: Trainings mit Strecke, Puls und Energie', () => {
  const { workouts, stats } = parseStravaCsv(csv(
    '1,"Nov 8, 2026, 6:12:03 PM","Lauf, abends",Run,2730,8430,178,2680,612,154',
    '2,"Nov 7, 2026, 7:30:00 AM",Morgenrunde,Ride,3600,25100,165,3500,780,138',
    '3,"Nov 5, 2026, 8:00:00 PM",Hallenkick,Soccer,5400,,,5400,900,',
  ));
  assert.equal(stats.used, 3);
  assert.equal(stats.skipped, 0);
  const [lauf, rad, kick] = workouts;
  assert.equal(lauf.sport, 'laufen');
  assert.equal(lauf.kind, 'ausdauer');
  assert.equal(lauf.km, 8.43, 'Strava schreibt Meter');
  assert.ok(Math.abs(lauf.durMin - 2680 / 60) < 0.01, 'die Bewegungszeit zählt');
  assert.equal(lauf.avgHr, 154);
  assert.equal(lauf.maxHr, 178);
  assert.equal(lauf.kcal, 612);
  assert.equal(lauf.src, 'Strava');
  assert.equal(rad.sport, 'radfahren');
  assert.equal(rad.km, 25.1);
  // Ohne Strecke und Puls bleibt der Rest brauchbar
  assert.equal(kick.sport, 'fussball');
  assert.equal(kick.km, null);
  assert.equal(kick.avgHr, null);
  assert.equal(kick.durMin, 90);
});

test('Strava: unbrauchbare Zeilen werden gezählt, nicht übernommen', () => {
  const { workouts, stats } = parseStravaCsv(csv(
    '1,,Ohne Datum,Run,600,1000,,600,,',
    '2,"Nov 8, 2026, 6:12:03 PM",Ohne Dauer,Run,,,,,,',
    '3,"Nov 8, 2026, 7:00:00 PM",Gut,Walk,1200,1500,,1200,80,',
  ));
  assert.equal(workouts.length, 1);
  assert.equal(stats.skipped, 2);
  assert.equal(workouts[0].sport, 'gehen');
});

test('Strava: Sportarten werden abgebildet, Unbekanntes landet bei „Anderes“', () => {
  assert.equal(stravaSport('TrailRun'), 'laufen');
  assert.equal(stravaSport('VirtualRide'), 'radfahren');
  assert.equal(stravaSport('WeightTraining'), 'kraft');
  assert.equal(stravaSport('RockClimbing'), 'klettern');
  assert.equal(stravaSport('Kitesurf'), 'andere');
});

test('Strecken rechnen in Kilometer um', () => {
  assert.equal(distanceKm(5000, 'm'), 5);
  assert.equal(distanceKm(3.1, 'mi'), 4.989);
  assert.equal(distanceKm(10.5, 'km'), 10.5);
  assert.equal(distanceKm(0, 'km'), null);
  assert.equal(distanceKm(-5, 'km'), null);
  assert.equal(distanceKm(NaN, 'km'), null);
});
