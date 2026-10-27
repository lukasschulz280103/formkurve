# Formkurve

Persönliche Tagesform, Recovery, Schlaf und Strain aus den Daten deines Amazfit Helio Strap, dazu ein kurzer Morgen- und Abendcheck und eine Analyse, welche Gewohnheiten und Umweltfaktoren deine Werte bewegen. Eine reine Web-App ohne Server: Jedes Konto besteht aus Name und PIN und liegt verschlüsselt auf dem eigenen Gerät. Freunde nutzen denselben Link und legen auf ihrem iPhone ein eigenes Konto an.

Grundlage ist das Konzeptdokument „Helio Strap: Score- und Umfragekonzept“. Version 0.3.0.

## Auf GitHub Pages bringen (kostenlos)

GitHub Pages braucht die Datei `index.html` ganz oben im Repository. Liegt sie eine Ebene tiefer, zum Beispiel in einem Ordner `formkurve`, zeigt GitHub „404 File not found“.

### Erstes Hochladen (Windows)

1. Auf github.com ein kostenloses Konto anlegen und ein neues Repository erstellen, Name zum Beispiel `formkurve`, Sichtbarkeit **Public** (GitHub Pages ist nur für öffentliche Repositories kostenlos; der Code enthält keine persönlichen Daten).
2. `formkurve-0.3.0.zip` herunterladen, Rechtsklick → **Alle extrahieren** → **Extrahieren**. Es öffnet sich ein Ordner mit `index.html`, `sw.js` und den Ordnern `css`, `js`, `icons`.
3. Im Repository auf **Add file → Upload files** klicken.
4. Im geöffneten Ordner **alles markieren** (Strg + A) und in das Upload-Feld ziehen. Nicht den Ordner selbst ziehen und nicht die ZIP-Datei.
5. Warten, bis alle Dateien aufgelistet sind, dann unten **Commit changes**.
6. Prüfen: In der Dateiliste des Repositorys steht `index.html` direkt neben `css`, `js` und `icons`.
7. **Settings → Pages**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`, **Save**. Nach ein bis zwei Minuten erscheint oben „Your site is live at …“ mit **Visit site**. Diese Adresse in **Safari** auf dem iPhone öffnen, Teilen-Symbol → **Zum Home-Bildschirm**.
8. Den Link an Freunde schicken; sie machen Schritt 7 auf ihrem iPhone.

### Wenn GitHub „404 File not found“ zeigt

- Im Repository liegt ein Ordner `formkurve` und darin erst `index.html`: Ordner öffnen, oben rechts **…** → **Delete directory** → **Commit changes**. Danach die Dateien wie oben hochladen.
- Im Repository liegt `formkurve.zip`: Datei öffnen, **…** → **Delete file** → **Commit changes**. GitHub entpackt ZIP-Dateien nicht; also wie oben entpacken und den Inhalt hochladen.
- Unter Settings → Pages ist ein anderer Ordner als `/ (root)` gewählt, etwa `/docs`: auf `/ (root)` stellen.
- Die Adresse von Hand eingetippt: besser über **Visit site** öffnen; Groß- und Kleinschreibung im Pfad zählt.

### Neue Version einspielen

1. Neue ZIP entpacken, im Repository **Add file → Upload files**, wieder den gesamten Inhalt hineinziehen, **Commit changes**.
2. Dateien mit gleichem Namen werden ersetzt. Nichts vorher löschen, nichts deaktivieren. Dateien, die eine neue Version nicht mehr braucht, schaden nicht.
3. Nach ein bis zwei Minuten lädt das iPhone beim nächsten Öffnen die neue Version. Die Nummer steht unter **Daten → Über Formkurve**. Das Symbol auf dem Home-Bildschirm bleibt, wie es ist.

## Deine Daten bei Updates

Ein Update ersetzt nur die App-Dateien auf GitHub. Konten, Messwerte, Antworten und Einstellungen liegen in der Datenbank der Web-App auf deinem Gerät; die neue Version liest sie beim Öffnen weiter.

- **Formatnummer und Umwandlung:** Die Daten tragen eine Formatnummer. Braucht eine neue Version ein anderes Format, wandelt sie einmal beim Öffnen um und ergänzt dabei nur. Antworten und Messwerte werden nie umgeschrieben. Daten einer neueren Version lässt eine ältere unangetastet.
- **Fragen bleiben gültig:** Jede Frage behält ihre Kennung. Fragen, die es nicht mehr gibt, werden weiter ausgewertet; die Supplements aus dem früheren Ernährungsmodul zum Beispiel zählen jetzt zur neuen Supplement-Frage.
- **Kein stiller Ersatzspeicher:** Antwortet der Gerätespeicher nicht, zeigt die App „Neu laden“, statt leer zu starten. So landen Eingaben nie in einem flüchtigen Zwischenspeicher.
- **Passende Dateien:** Der Service Worker fragt bei jedem Öffnen nach geänderten Dateien und hält je Version einen eigenen Offline-Zwischenspeicher. Den alten löscht er erst, wenn die neue Version läuft; die Datenbank fasst er nie an.
- **Backup-Erinnerung:** Nach zwei Wochen ohne Backup und danach alle 30 Tage erinnert eine Karte auf „Heute“ daran. Die Antworten aus den Checks gibt es nur auf dem Gerät; Messwerte lassen sich jederzeit neu aus Apple Health holen.

Was trotzdem Daten kosten kann:

- das Symbol vom Home-Bildschirm löschen (für ein Update nie nötig),
- das Repository umbenennen oder einen neuen GitHub-Benutzernamen wählen (andere Adresse, also eine neue, leere App),
- ohne Backup das Gerät wechseln.

## Konto anlegen

1. App öffnen → **Neues Konto anlegen** → Name und PIN (4 bis 8 Ziffern). Keine E-Mail, kein Passwort.
2. Die App zeigt einmalig einen **Wiederherstellungscode** (16 Zeichen). Ihn im Passwort-Manager oder in Notizen sichern. Damit setzt du eine neue PIN, falls du sie vergisst.
3. **Standort erlauben** oder „Später“.
4. Optional Geburtsjahr, Geschlecht, Größe und Gewicht. Alles lässt sich überspringen und später unter **Daten → Profil** nachtragen.

„Auf diesem Gerät angemeldet bleiben“ ist vorausgewählt. **Daten → Konto** bietet Abmelden, PIN ändern, einen neuen Wiederherstellungscode und Konto löschen. Nach fünf falschen PINs wartet die App erst 30 Sekunden, danach jeweils doppelt so lange, höchstens 15 Minuten. Wer erst schauen will, tippt auf **Ohne Konto ausprobieren**.

## Wo die Daten liegen

- **Lokal, verschlüsselt.** Jedes Konto hat eine eigene Datenbank im Speicher der Web-App (IndexedDB), Inhalte mit AES-GCM (256 Bit) verschlüsselt. Den Schlüssel sichern die PIN (PBKDF2-SHA-256, 310.000 Runden) und der Wiederherstellungscode.
- **Kein Abgleich zwischen Geräten.** Für ein neues iPhone: **Daten → Backup exportieren**, auf dem neuen Gerät ein Konto anlegen und **Backup laden**.
- **Warum nicht über GitHub?** GitHub Pages liefert nur die App-Dateien aus. Um Daten in ein Repository zu schreiben, bräuchte die App einen Zugangsschlüssel, der im öffentlichen Code für alle lesbar wäre.
- **Home-Bildschirm nutzen.** Safari löscht die gespeicherten Daten einer Website, wenn du sie an sieben Tagen mit Safari-Nutzung nicht besucht hast. Web-Apps auf dem Home-Bildschirm zählen laut WebKit nur ihre eigenen Nutzungstage und sollen ihre Daten behalten. Safari und die Home-Bildschirm-App haben getrennte Speicher, also auch getrennte Konten.
- **Grenzen der PIN.** Die PIN schützt vor anderen Personen am selben Gerät. Den eigentlichen Schutz liefert die Gerätesperre des iPhones; wer mehr will, nimmt eine 8-stellige PIN.

## Der Check-in

Morgens und abends gibt es zuerst wenige **Kernfragen**, danach **optionale Fragen**, die wichtigsten zuerst.

| | Kernfragen | Folgefragen bei Bedarf |
| --- | --- | --- |
| Morgen | Erholung, Schlafgefühl, Muskelkater, Krankheitsgefühl | — |
| Abend | Stress, Alkohol, Koffein, Training | Anzahl Getränke, Uhrzeit des letzten Koffeins, Trainingsart, Dauer, Anstrengung |

Supplements werden zur Kernfrage, sobald du in den letzten 14 Tagen welche angegeben hast; Nikotin und Cannabis, wenn du sie in den Einstellungen einschaltest. Die optionalen Fragen sind nach ihrer erwarteten Wirkung auf HRV, Ruhepuls und Schlaf sortiert: abends zum Beispiel besondere Ereignisse, Supplements, letzte Mahlzeit, Erholungsmaßnahmen, Bildschirm vor dem Schlafen. Ernährungs-, Stress- und Schlafumgebungsfragen rücken an ihren Vorschlagstagen nach vorn, der Wochenrückblick erscheint nur am gewählten Tag.

**Daten → Anzeige und Check-in → Umfang:** „Kurz“ zeigt nur die Kernfragen, „Standard“ dazu die drei wichtigsten optionalen, „Ausführlich“ alle. Der Rest liegt immer hinter **Weitere Fragen**. Unbeantwortet bleibt leer und zählt nicht als „Nein“.

**Supplements:** über 50 Mittel in fünf Gruppen (Schlaf und Entspannung, Training und Leistung, Vitamine, Mineralstoffe, Weitere), mit Suche und eigenen Einträgen. Zuletzt genutzte stehen oben und sind vom Vortag vorbelegt. Die Einsichten vergleichen für jedes Mittel Tage mit und ohne.

## Standort und Umweltdaten

- Beim Anlegen „Standort erlauben“ oder später **Daten → Umwelt → Standort automatisch**.
- Die Koordinate wird auf etwa 1 km gerundet und nur auf dem Gerät gespeichert. Nur diese gerundete Koordinate geht an Open-Meteo.
- Beim ersten Mal lädt die App 92 Tage rückwirkend. Bei jedem Öffnen prüft sie still den Standort, wenn die Erlaubnis besteht; ab 25 km Abstand gilt der neue Ort. Wetter lädt sie höchstens alle drei Stunden neu.
- Ohne Standort-Erlaubnis: **Ort lieber von Hand wählen**.

## Infopunkte mit Normalwerten

Jeder Wert im Dashboard hat ein (i) mit dem allgemeinen Normal- oder Richtwert, der Quelle und der Einordnung deines Werts. Ein Etikett zeigt die Herkunft: offizielle Stelle (WHO, NHS, Royal College of Physicians, National Sleep Foundation, American Heart Association, Deutscher Wetterdienst), Studie, Fachliteratur oder eigene Formkurve-Berechnung. Die Tabelle mit allen Werten steht im Konzeptdokument (Abschnitt 12).

## So kommen die Daten in die App

| Weg | Wofür | Wie |
| --- | --- | --- |
| Apple-Health-Export | Historie, Lücken nachholen | Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“ → in Dateien sichern → in Formkurve unter **Daten → Apple-Health-Export wählen** |
| Kurzbefehl „Formkurve Sync“ | täglich | Kurzbefehl ausführen → Formkurve öffnen → **Daten → Einfügen und importieren** |

Die Anleitung für den Kurzbefehl steht in [KURZBEFEHL.md](KURZBEFEHL.md) und in der App unter **Daten**. Importe landen immer im gerade angemeldeten Konto. Vorher in der Health-App unter Profilbild → Apps → Zepp alle Kategorien freigeben.

## Täglicher Ablauf

1. Morgens: Kurzbefehl ausführen, Formkurve öffnen, Daten einfügen.
2. Morgencheck: vier Kernfragen, etwa 20 Sekunden. Erst danach zeigt die App die Scores, damit die Zahl dein Gefühl nicht beeinflusst.
3. Abends: Abendcheck, etwa 30 Sekunden, optionale Fragen nach Lust und Zeit. Erinnern kann eine Kurzbefehl-Automation „Tageszeit 21:00 → Mitteilung anzeigen“.
4. Nach etwa 6 Wochen werden die Einsichten belastbar.

## Was wo im Code steht

| Datei | Inhalt |
| --- | --- |
| `js/version.js` | Versionsnummer (muss zu `sw.js` passen; ein Test prüft das) |
| `js/data/db.js`, `js/data/repo.js` | Datenbank, Formatnummer und Umwandlungen bei Updates |
| `js/auth/` | Konten, PIN, Wiederherstellung, Verschlüsselung |
| `js/survey/catalog.js` | Fragenkatalog mit Kern- und optionalen Fragen, Rangfolge, Folgefragen |
| `js/survey/supplements.js` | Supplement-Katalog, eigene Mittel, Zuordnung alter Antworten |
| `js/survey/engine.js` | welche Fragen wann erscheinen, Vorbelegung |
| `js/analysis/insights.js` | Einflussfaktoren (auch je Supplement), Permutationstest, Benjamini-Hochberg, Ridge |
| `js/norms/references.js` | Normal- und Richtwerte mit Quellen für alle Infopunkte |
| `js/context/` | Standort, Wetter, Feinstaub und Pollen von Open-Meteo |
| `js/model/` | Formeln für Baseline, Recovery, Schlaf, Strain, Balance, Fitness, Tagesform |
| `js/ui/` | Oberfläche (Preact mit htm, ohne Build-Schritt) |
| `sw.js` | Offline-Zwischenspeicher je Version |

## Entwickeln

```sh
npm install        # nur für Tests und Build-Werkzeuge
npm test           # Tests für Formeln, Importe, Einflussanalyse, Konten, Check-in und Updates
npm run serve      # lokaler Server auf http://localhost:8080
npm run build      # dist/formkurve-vorschau.html und dist/formkurve-<version>.zip
```

Für eine neue Version die Nummer in `js/version.js` und `sw.js` erhöhen. Neue Fragen bekommen eine neue Kennung; bestehende Kennungen und Antwortwerte nie umbenennen. Ändert sich das Datenformat, `DATA_FORMAT` in `js/data/repo.js` erhöhen und eine Umwandlung in `MIGRATIONS` ergänzen.

## Grenzen

- Die Scores sind eine eigene Heuristik, keine medizinische Bewertung. Bei Beschwerden zählt ärztlicher Rat.
- Welche Werte Zepp an Apple Health liefert, hängt von der Zepp-Version ab.
- Konten gelten nur auf dem Gerät, auf dem sie angelegt wurden. Ohne PIN und ohne Wiederherstellungscode sind die Daten verloren.
- Open-Meteo liefert Wetter nur 92 Tage rückwirkend.

Lizenzen: Preact und htm (MIT), fflate (MIT). Wetter: Open-Meteo.com (CC BY 4.0); Luftqualität und Pollen: Copernicus Atmosphere Monitoring Service über Open-Meteo.
