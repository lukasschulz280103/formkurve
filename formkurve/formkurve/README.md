# Formkurve

Persönliche Tagesform, Recovery, Schlaf und Strain aus den Daten deines Amazfit Helio Strap, dazu ein täglicher Morgen- und Abendcheck und eine Analyse, welche Gewohnheiten und Umweltfaktoren deine Werte bewegen. Eine reine Web-App: kein Server, kein Konto, alle Daten bleiben auf deinem iPhone.

Grundlage ist das Konzeptdokument „Helio Strap: Score- und Umfragekonzept“.

## So kommen die Daten in die App

Zepp schreibt die Strap-Daten nach Apple Health. Ein Browser darf Apple Health nicht lesen, deshalb gibt es zwei kostenlose Wege:

| Weg | Wofür | Wie |
| --- | --- | --- |
| Apple-Health-Export | Historie, Lücken nachholen | Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“ → in Dateien sichern → in Formkurve unter **Daten → Apple-Health-Export wählen** |
| Kurzbefehl „Formkurve Sync“ | täglich | Kurzbefehl ausführen → Formkurve öffnen → **Daten → Einfügen und importieren** |

Die Anleitung für den Kurzbefehl steht in [KURZBEFEHL.md](KURZBEFEHL.md) und in der App unter **Daten**.

Vorher in der Health-App unter Profilbild → Apps → Zepp alle Kategorien freigeben. Was wirklich ankommt, zeigt die App nach dem Import unter **Daten → Was in deinen Daten steckt**.

## Auf dem iPhone installieren (kostenlos über GitHub Pages)

1. Kostenloses Konto auf github.com anlegen (am besten am Computer).
2. Neues Repository anlegen, Name zum Beispiel `formkurve`, Sichtbarkeit **Public** (GitHub Pages ist nur für öffentliche Repositories kostenlos; der Code enthält keine persönlichen Daten).
3. Die ZIP-Datei entpacken und den **Inhalt** des Ordners `formkurve` über „Add file → Upload files“ hochladen (Ordner `css`, `js`, `icons` mit hineinziehen), dann „Commit changes“.
4. Im Repository unter **Settings → Pages**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`, speichern.
5. Nach etwa einer Minute ist die App unter `https://DEIN-NAME.github.io/formkurve/` erreichbar. In **Safari** öffnen, Teilen-Symbol → **Zum Home-Bildschirm**.
6. Ab jetzt immer über das Symbol auf dem Home-Bildschirm öffnen. Die Daten liegen im Speicher dieser Web-App; Safari und die Home-Bildschirm-App haben getrennte Speicher.

Alternative ohne GitHub: den Ordner auf einem kostenlosen Static-Hosting wie Netlify oder Cloudflare Pages hochladen. Wichtig ist nur HTTPS.

## Täglicher Ablauf

1. Morgens: Kurzbefehl ausführen, Formkurve öffnen, Daten einfügen.
2. Morgencheck beantworten (etwa 30 Sekunden). Erst danach zeigt die App die Scores, damit die Zahl dein Gefühl nicht beeinflusst.
3. Abends: Abendcheck (etwa 45 Sekunden). Erinnern kann dich eine Kurzbefehl-Automation „Tageszeit 21:00 → Mitteilung anzeigen“, weil eine kostenlose Web-App keine geplanten Mitteilungen senden darf.
4. Nach etwa 6 Wochen werden die Einsichten belastbar.

Backup: **Daten → Backup exportieren**. Die Antworten aus den Checks gibt es nur in der App; Messwerte lassen sich jederzeit neu aus Apple Health holen.

## Was wo im Code steht

| Datei | Inhalt |
| --- | --- |
| `js/core/config.js` | alle Gewichte und Schwellen (auch in der App unter Daten → Modell änderbar) |
| `js/model/scores.js` | Formeln: Baseline, Recovery, Schlaf, Strain mit Kraft-Zuschlag, Balance, Fitness, Tagesform |
| `js/model/pipeline.js` | rechnet aus Rohdaten alle Tageswerte |
| `js/model/sleep.js` | Schlafsitzungen und Schlafphasen |
| `js/survey/catalog.js` | Fragenkatalog mit Modulen und Verzweigungen |
| `js/analysis/insights.js` | Einflussfaktoren, Permutationstest, Benjamini-Hochberg, Ridge |
| `js/import/` | Kurzbefehl-Format und Apple-Health-Export |
| `js/context/weather.js` | Wetter, Feinstaub und Pollen von Open-Meteo |
| `js/demo/generate.js` | Beispieldaten mit eingebauten Effekten |
| `js/ui/` | Oberfläche (Preact mit htm, ohne Build-Schritt) |

## Entwickeln

Die App läuft ohne Build-Schritt; jede Datei wird direkt ausgeliefert.

```sh
npm install        # nur für Tests und Build-Werkzeuge
npm test           # Tests für alle Formeln, Importe und die Einflussanalyse
npm run serve      # lokaler Server auf http://localhost:8080
npm run build      # dist/formkurve-vorschau.html und dist/formkurve.zip
```

Wenn du mit Claude Code weiterbaust: Das Konzeptdokument und diese README als Kontext mitgeben, und nach jeder Änderung `npm test` laufen lassen.

## Grenzen

- Die Scores sind eine eigene Heuristik, keine medizinische Bewertung. Bei Beschwerden zählt ärztlicher Rat.
- Welche Werte Zepp an Apple Health liefert (vor allem HRV, Schlafphasen, Atemfrequenz, Hauttemperatur), hängt von der Zepp-Version ab.
- Open-Meteo liefert Wetter nur 92 Tage rückwirkend; öffne die App also mindestens alle drei Monate.

Lizenzen: Preact und htm (MIT), fflate (MIT). Wetter: Open-Meteo.com (CC BY 4.0); Luftqualität und Pollen: Copernicus Atmosphere Monitoring Service über Open-Meteo.
