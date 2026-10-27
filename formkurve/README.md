# Formkurve

Persönliche Tagesform, Recovery, Schlaf und Strain aus den Daten deines Amazfit Helio Strap, dazu ein täglicher Morgen- und Abendcheck und eine Analyse, welche Gewohnheiten und Umweltfaktoren deine Werte bewegen. Eine reine Web-App ohne Server: Jedes Konto besteht aus Name und PIN und liegt verschlüsselt auf dem eigenen Gerät. Freunde nutzen denselben Link und legen auf ihrem iPhone ein eigenes Konto an.

Grundlage ist das Konzeptdokument „Helio Strap: Score- und Umfragekonzept“. Version 0.2.

## Konto anlegen

1. App öffnen → **Neues Konto anlegen** → Name und PIN (4 bis 8 Ziffern). Keine E-Mail, kein Passwort.
2. Die App zeigt einmalig einen **Wiederherstellungscode** (16 Zeichen, zum Beispiel `K7QM-2XRA-…`). Ihn im Passwort-Manager oder in Notizen sichern. Damit setzt du eine neue PIN, falls du sie vergisst.
3. **Standort erlauben** oder „Später“ (siehe unten).
4. Optional Geburtsjahr, Geschlecht, Größe und Gewicht. Alles lässt sich überspringen und später unter **Daten → Profil** nachtragen; die App erinnert nach ein paar Tagen einmal daran.

„Auf diesem Gerät angemeldet bleiben“ ist vorausgewählt; dann öffnet die App direkt. **Daten → Konto** bietet Abmelden, PIN ändern, einen neuen Wiederherstellungscode und Konto löschen. Nach fünf falschen PINs wartet die App erst 30 Sekunden, danach jeweils doppelt so lange, höchstens 15 Minuten.

**Freunde:** Schick ihnen den Link. Jede Person legt auf ihrem eigenen Gerät ein Konto an. Mehrere Konten auf einem Gerät gehen auch (etwa auf einem geteilten iPad); jedes ist getrennt verschlüsselt. Wer erst schauen will, tippt auf **Ohne Konto ausprobieren** und sieht 90 Tage Beispieldaten.

## Wo die Daten liegen

- **Lokal, verschlüsselt.** Jedes Konto hat eine eigene Datenbank im Speicher der Web-App (IndexedDB). Inhalte sind mit AES-GCM (256 Bit) verschlüsselt. Den Schlüssel sichern die PIN (PBKDF2-SHA-256, 310.000 Runden) und der Wiederherstellungscode. Ohne eins von beiden lassen sich die Daten nicht öffnen, auch nicht vom Entwickler.
- **Kein Abgleich zwischen Geräten.** Für ein neues iPhone: **Daten → Backup exportieren**, auf dem neuen Gerät ein Konto anlegen und **Backup laden**. Messwerte lassen sich jederzeit neu aus Apple Health holen; die Antworten aus den Checks gibt es nur im Backup.
- **Warum nicht über GitHub?** GitHub Pages liefert nur die App-Dateien aus. Um Daten in ein Repository zu schreiben, bräuchte die App einen GitHub-Zugangsschlüssel. Im öffentlichen Code wäre er für alle lesbar, und Gesundheitsdaten mehrerer Personen gehören nicht in ein Repository. Weil lokales Speichern funktioniert, bleibt alles lokal.
- **Home-Bildschirm nutzen.** Safari löscht die gespeicherten Daten einer Website, wenn du sie an sieben Tagen mit Safari-Nutzung nicht besucht hast. Web-Apps auf dem Home-Bildschirm zählen laut WebKit nur ihre eigenen Nutzungstage und sollen ihre Daten behalten. Außerdem bittet Formkurve den Browser um dauerhaften Speicher.
- **Grenzen der PIN.** Die PIN schützt vor anderen Personen am selben Gerät. Wer das entsperrte iPhone in der Hand hat, kommt bei „angemeldet bleiben“ in die App. Gegen jemanden, der die Speicherdateien kopiert und offline rät, hilft eine kurze PIN wenig. Den eigentlichen Schutz liefert die Gerätesperre des iPhones; wer mehr will, nimmt eine 8-stellige PIN.

## Standort und Umweltdaten

- Beim Anlegen „Standort erlauben“ oder später **Daten → Umwelt → Standort automatisch**.
- Die Koordinate wird auf zwei Nachkommastellen gerundet (etwa 1 km) und nur auf dem Gerät gespeichert. Nur diese gerundete Koordinate geht an Open-Meteo.
- Beim ersten Mal lädt die App 92 Tage rückwirkend, damit die Einsichten sofort Umweltfaktoren prüfen können.
- Bei jedem Öffnen prüft sie still den Standort, aber nur, wenn die Erlaubnis schon erteilt ist; ungefragt fragt sie nie. Liegt der neue Ort mehr als 25 km entfernt, gilt er ab jetzt (Reisen). Wetter lädt sie höchstens alle drei Stunden neu. **Laden** unter Daten → Umwelt holt Ort und Wetter sofort.
- Gelesen werden: Tiefstwert und Luftfeuchte in der Nacht, Tageshöchstwert, Luftdruck und seine Änderung, Feinstaub (PM2,5 und PM10), Ozon, Pollen (Erle, Birke, Gräser, Beifuß, Ambrosia), Tageslänge, Sonnenstunden und Niederschlag.
- Ohne Standort-Erlaubnis: **Ort lieber von Hand wählen**.

## Infopunkte mit Normalwerten

Jeder Wert im Dashboard hat ein (i): auf **Heute**, in jedem Diagramm unter **Verlauf** und im **Profil**. Das Blatt zeigt, was der Wert bedeutet, wie dein Wert einzuordnen ist (mit Alter, wenn angegeben), die Normal- oder Richtwerte mit Quelle, wie Formkurve den Wert nutzt und wo die Grenzen liegen. Ein Etikett sagt, woher die Werte stammen:

| Etikett | Bedeutung |
| --- | --- |
| Richtwerte offizieller Stellen | WHO, NHS, Royal College of Physicians, National Sleep Foundation, American Heart Association, Deutscher Wetterdienst und andere |
| Werte aus Studien | keine amtliche Norm, aber veröffentlichte Vergleichswerte |
| Fachliteratur | Lehrbuchwerte, zum Beispiel aus dem MSD Manual |
| Eigene Formkurve-Berechnung | Scores der App; dafür gibt es keine offizielle Norm |

Die wichtigsten Werte:

| Wert | Normal- oder Richtwert | Quelle |
| --- | --- | --- |
| Ruhepuls | 60–100 Schläge pro Minute; Sportler bis hinunter auf 40 | American Heart Association; DAK-Gesundheit |
| Maximalpuls | 208 − 0,7 × Alter (Faustformel 220 − Alter) | Tanaka et al. 2001; AHA |
| Atemfrequenz | 12–20 pro Minute in Ruhe | RCP, NEWS2 |
| Blutsauerstoff | 95–99 % ideal; 92 % oder weniger: sofort Hilfe holen | NHS; RCP, NEWS2 |
| Temperatur | Fieber meist ab 38 °C Körpertemperatur | NHS; RCP, NEWS2 |
| HRV | RMSSD im Mittel 42 ms (19–75), SDNN 50 ms (32–93); nur als grober Vergleich | Shaffer & Ginsberg 2017 nach Nunan et al. 2010 |
| Schlafdauer | 18–64 Jahre: 7–9 h; ab 65: 7–8 h | National Sleep Foundation |
| Schlafeffizienz, Einschlafen, Wachphasen | mindestens 85 %; höchstens 30 min; höchstens einmal aufwachen | National Sleep Foundation (Ohayon et al.) |
| Tiefschlaf, REM | 13–23 %, 20–25 % des Schlafs (junge Erwachsene) | MSD Manual |
| Bewegung | 150–300 min moderat oder 75–150 min intensiv pro Woche, Kraft an 2 Tagen | WHO |
| Schritte | unter 60 Jahren bis etwa 8.000–10.000, ab 60 bis etwa 6.000–8.000 | The Lancet Public Health 2022 |
| Belastung 7 zu 28 Tage | 0,8–1,3 | Gabbett 2016 |
| BMI | 18,5–24,9 Normalgewicht | WHO |
| Feinstaub PM2,5 | Tagesmittel höchstens 15 µg/m³ | WHO-Luftgüteleitlinien 2021 |
| Hitze | Tropennacht: nicht unter 20 °C; heißer Tag: ab 30 °C | DWD, über HLNUG |
| Pollen | DWD-Index 0–3; Formkurve wertet ab 50 Pollen/m³ als Belastung (eigener Schwellenwert) | Deutscher Wetterdienst |

Die Scores (Tagesform, Recovery, Schlaf, Strain, Fitness) vergleicht die App vor allem mit deinem eigenen Normalbereich der letzten 28 Tage. Die allgemeinen Normalwerte dienen zur Einordnung, nicht als Diagnose.

## So kommen die Daten in die App

Zepp schreibt die Strap-Daten nach Apple Health. Ein Browser darf Apple Health nicht lesen, deshalb gibt es zwei kostenlose Wege:

| Weg | Wofür | Wie |
| --- | --- | --- |
| Apple-Health-Export | Historie, Lücken nachholen | Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“ → in Dateien sichern → in Formkurve unter **Daten → Apple-Health-Export wählen** |
| Kurzbefehl „Formkurve Sync“ | täglich | Kurzbefehl ausführen → Formkurve öffnen → **Daten → Einfügen und importieren** |

Die Anleitung für den Kurzbefehl steht in [KURZBEFEHL.md](KURZBEFEHL.md) und in der App unter **Daten**. Importe landen immer im gerade angemeldeten Konto.

Vorher in der Health-App unter Profilbild → Apps → Zepp alle Kategorien freigeben. Was wirklich ankommt, zeigt die App nach dem Import unter **Daten → Was in deinen Daten steckt**.

## Auf dem iPhone installieren (kostenlos über GitHub Pages)

1. Kostenloses Konto auf github.com anlegen (am besten am Computer).
2. Neues Repository anlegen, Name zum Beispiel `formkurve`, Sichtbarkeit **Public** (GitHub Pages ist nur für öffentliche Repositories kostenlos; der Code enthält keine persönlichen Daten).
3. Die ZIP-Datei entpacken und den **Inhalt** des Ordners `formkurve` über „Add file → Upload files“ hochladen (Ordner `css`, `js`, `icons` mit hineinziehen), dann „Commit changes“. Bei einem Update dieselben Dateien erneut hochladen; die Konten und Daten auf den Geräten bleiben erhalten.
4. Im Repository unter **Settings → Pages**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`, speichern.
5. Nach etwa einer Minute ist die App unter `https://DEIN-NAME.github.io/formkurve/` erreichbar. In **Safari** öffnen, Teilen-Symbol → **Zum Home-Bildschirm**.
6. Ab jetzt immer über das Symbol auf dem Home-Bildschirm öffnen. Safari und die Home-Bildschirm-App haben getrennte Speicher, also auch getrennte Konten.
7. Den Link an Freunde schicken; sie machen Schritt 5 und 6 auf ihrem iPhone.

Alternative ohne GitHub: den Ordner auf einem kostenlosen Static-Hosting wie Netlify oder Cloudflare Pages hochladen. Wichtig ist nur HTTPS, sonst fehlen Verschlüsselung und Standort.

Wer v0.1 schon genutzt hat: Das erste neu angelegte Konto übernimmt die bisherigen Daten automatisch.

## Täglicher Ablauf

1. Morgens: Kurzbefehl ausführen, Formkurve öffnen, Daten einfügen.
2. Morgencheck beantworten (etwa 30 Sekunden). Erst danach zeigt die App die Scores, damit die Zahl dein Gefühl nicht beeinflusst.
3. Abends: Abendcheck (etwa 45 Sekunden). Erinnern kann dich eine Kurzbefehl-Automation „Tageszeit 21:00 → Mitteilung anzeigen“, weil eine kostenlose Web-App keine geplanten Mitteilungen senden darf.
4. Nach etwa 6 Wochen werden die Einsichten belastbar.

## Was wo im Code steht

| Datei | Inhalt |
| --- | --- |
| `js/auth/crypto.js` | Schlüssel aus PIN und Code, AES-GCM, verschlüsselter Speicher |
| `js/auth/accounts.js` | Konten anlegen, anmelden, Wartezeit, Wiederherstellung, Sitzung |
| `js/norms/references.js` | Normal- und Richtwerte mit Quellen für alle Infopunkte |
| `js/context/location.js` | Standort abfragen und runden |
| `js/context/weather.js` | Wetter, Feinstaub und Pollen von Open-Meteo |
| `js/core/config.js` | alle Gewichte und Schwellen, Profil, Alter, Maximalpuls, BMI |
| `js/model/scores.js` | Formeln: Baseline, Recovery, Schlaf, Strain mit Kraft-Zuschlag, Balance, Fitness, Tagesform |
| `js/model/pipeline.js` | rechnet aus Rohdaten alle Tageswerte |
| `js/model/sleep.js` | Schlafsitzungen und Schlafphasen |
| `js/survey/catalog.js` | Fragenkatalog mit Modulen und Verzweigungen |
| `js/analysis/insights.js` | Einflussfaktoren, Permutationstest, Benjamini-Hochberg, Ridge |
| `js/import/` | Kurzbefehl-Format und Apple-Health-Export |
| `js/demo/generate.js` | Beispieldaten mit eingebauten Effekten |
| `js/ui/` | Oberfläche (Preact mit htm, ohne Build-Schritt); `auth.js` Anmeldung, `info.js` Infoblätter |

## Entwickeln

Die App läuft ohne Build-Schritt; jede Datei wird direkt ausgeliefert.

```sh
npm install        # nur für Tests und Build-Werkzeuge
npm test           # Tests für Formeln, Importe, Einflussanalyse, Konten und Normalwerte
npm run serve      # lokaler Server auf http://localhost:8080
npm run build      # dist/formkurve-vorschau.html und dist/formkurve.zip
```

Wenn du mit Claude Code weiterbaust: Das Konzeptdokument und diese README als Kontext mitgeben, und nach jeder Änderung `npm test` laufen lassen.

## Grenzen

- Die Scores sind eine eigene Heuristik, keine medizinische Bewertung. Bei Beschwerden zählt ärztlicher Rat.
- Welche Werte Zepp an Apple Health liefert (vor allem HRV, Schlafphasen, Atemfrequenz, Hauttemperatur), hängt von der Zepp-Version ab.
- Konten gelten nur auf dem Gerät, auf dem sie angelegt wurden. Ohne PIN und ohne Wiederherstellungscode sind die Daten verloren.
- Open-Meteo liefert Wetter nur 92 Tage rückwirkend; öffne die App also mindestens alle drei Monate.

Lizenzen: Preact und htm (MIT), fflate (MIT). Wetter: Open-Meteo.com (CC BY 4.0); Luftqualität und Pollen: Copernicus Atmosphere Monitoring Service über Open-Meteo.
