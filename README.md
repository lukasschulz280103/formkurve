# Formkurve

Persönliche Tagesform, Recovery, Schlaf und Strain aus den Daten deines Amazfit Helio Strap, dazu ein kurzer Morgen- und Abendcheck, ein Logbuch für Wasser, Koffein, Glück, Sport, Arbeitszeit und Tagebuch und eine Analyse, welche Gewohnheiten und Umweltfaktoren deine Werte bewegen. Eine Web-App: Jedes Konto besteht aus Name und PIN und liegt verschlüsselt auf dem Gerät. Wer will, verbindet es mit einem Online-Konto (E-Mail und Passwort) und nutzt es auf mehreren Geräten gleichzeitig; die Daten werden vorher auf dem Gerät verschlüsselt. Freunde nutzen denselben Link und legen ihr eigenes Konto an.

Grundlage ist das Konzeptdokument „Helio Strap: Score- und Umfragekonzept“. Version 0.12.0.

## Auf GitHub Pages bringen (kostenlos)

GitHub Pages braucht die Datei `index.html` ganz oben im Repository. Liegt sie eine Ebene tiefer, zum Beispiel in einem Ordner `formkurve`, zeigt GitHub „404 File not found“.

### Erstes Hochladen (Windows)

1. Auf github.com ein kostenloses Konto anlegen und ein neues Repository erstellen, Name zum Beispiel `formkurve`, Sichtbarkeit **Public** (GitHub Pages ist nur für öffentliche Repositories kostenlos; der Code enthält keine persönlichen Daten).
2. `formkurve-0.12.0.zip` herunterladen, Rechtsklick → **Alle extrahieren** → **Extrahieren**. Es öffnet sich ein Ordner mit `index.html`, `sw.js` und den Ordnern `css`, `js`, `icons`.
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
2. Dateien mit gleichem Namen werden ersetzt. Nichts vorher löschen, nichts deaktivieren. Dateien, die eine neue Version nicht mehr braucht, schaden nicht. Die eigene Datei `sync-config.js` (Online-Konten) ist nie im ZIP und bleibt deshalb erhalten.
3. Nach ein bis zwei Minuten lädt das iPhone beim nächsten Öffnen die neue Version. Die Nummer steht unter **Profil → Über Formkurve**. Das Symbol auf dem Home-Bildschirm bleibt, wie es ist.

## Deine Daten bei Updates

Ein Update ersetzt nur die App-Dateien auf GitHub. Konten, Messwerte, Antworten, Logbuch und Einstellungen liegen in der Datenbank der Web-App auf deinem Gerät; die neue Version liest sie beim Öffnen weiter.

- **Formatnummer und Umwandlung:** Die Daten tragen eine Formatnummer. Braucht eine neue Version ein anderes Format, wandelt sie einmal beim Öffnen um und ergänzt dabei nur. Antworten und Messwerte werden nie umgeschrieben. Daten einer neueren Version lässt eine ältere unangetastet.
- **Version 0.8 ergänzt nur Auswertung:** Die Frühwarnungen rechnen aus vorhandenen Tageswerten. Gespeichert werden nur die Pausen („Verstanden“) und die Einstellungen.
- **Version 0.7 ändert nur die Oberfläche:** Der Kalender rechnet aus den vorhandenen Tageswerten; gespeichert wird nur, welcher Wert die Farben bestimmt (eine Einstellung).
- **Version 0.6 ändert nur die Oberfläche:** Datenbank, Datenformat und Abgleich bleiben wie in 0.5. Alte Adressen wie `#daten`, `#einsichten` oder `#check` führen zur neuen Stelle.
- **Neue Bereiche kommen dazu, nichts wird umgebaut:** Version 0.5 ergänzt in der Datenbank einen eigenen Bereich für das Logbuch. Bestehende Bereiche bleiben, wie sie sind. Ab dieser Version öffnet die App auch eine Datenbank, die eine spätere Version schon erweitert hat. Ist beim Update noch ein zweites Fenster mit der alten Version offen, meldet es „Bitte die App neu laden“.
- **Fragen bleiben gültig:** Jede Frage behält ihre Kennung. Fragen, die es nicht mehr gibt, werden weiter ausgewertet; die Supplements aus dem früheren Ernährungsmodul zum Beispiel zählen jetzt zur neuen Supplement-Frage, alte Notizen aus dem Abendcheck zeigt das Logbuch beim jeweiligen Tag.
- **Kein stiller Ersatzspeicher:** Antwortet der Gerätespeicher nicht, zeigt die App „Neu laden“, statt leer zu starten. So landen Eingaben nie in einem flüchtigen Zwischenspeicher.
- **Passende Dateien:** Der Service Worker fragt bei jedem Öffnen nach geänderten Dateien und hält je Version einen eigenen Offline-Zwischenspeicher. Den alten löscht er erst, wenn die neue Version läuft; die Datenbank fasst er nie an.
- **Backup-Erinnerung:** Nach zwei Wochen ohne Backup und danach alle 30 Tage erinnert eine Karte auf „Heute“ daran. Antworten und Logbuch gibt es nur auf dem Gerät (oder im Online-Konto); Messwerte lassen sich jederzeit neu aus Apple Health holen. Das Backup enthält das Logbuch; beim Laden wird es mit dem Logbuch auf dem Gerät zusammengeführt.

Was trotzdem Daten kosten kann:

- das Symbol vom Home-Bildschirm löschen (für ein Update nie nötig),
- das Repository umbenennen oder einen neuen GitHub-Benutzernamen wählen (andere Adresse, also eine neue, leere App),
- ohne Backup das Gerät wechseln.

## Auf mehreren Geräten (Online-Konto)

Mit einem Online-Konto nutzt du dieselben Daten auf iPhone, iPad und Mac, auch gleichzeitig. Die Geräte gleichen beim Öffnen, jede Minute während die App offen ist und ein paar Sekunden nach jeder Eingabe ab.

**So sieht es für dich und deine Freunde aus**

1. Erstes Gerät: Konto mit Name und PIN anlegen, dann im Schritt „Auf mehreren Geräten nutzen“ E-Mail und Passwort eingeben. Ein bestehendes Konto verbindest du unter **Profil → Konto → Auf mehreren Geräten → Online-Konto verbinden**. Die App lädt alles verschlüsselt hoch.
2. Weiteres Gerät: auf der Startseite **Mit Online-Konto anmelden**, E-Mail und Passwort, dann einmal den **Wiederherstellungscode**, dann eine PIN für dieses Gerät. Die App lädt alle Daten herunter.
3. Passwort vergessen: auf der Anmeldeseite **Passwort vergessen?**. Es kommt eine E-Mail mit einem Link zum Zurücksetzen. Die Daten bleiben, weil nicht das Passwort sie verschlüsselt. Andere Geräte fragen danach einmal nach dem neuen Passwort.

**Was der Server sieht:** Jeder Eintrag (Messwert-Paket eines Tages, Workout, Check-in-Tag, Logbuch-Tag samt Tagebuch, Einstellungen) wird auf dem Gerät komprimiert und mit dem Datenschlüssel des Kontos (AES-GCM, 256 Bit) verschlüsselt. Auch die Namen der Einträge sind verschlüsselt (HMAC), sodass weder Datum noch Messart lesbar sind. Den Datenschlüssel kennt der Server nur verpackt mit deinem Wiederherstellungscode, den er nie erfährt. Firebase sieht also: deine E-Mail, Zeitpunkte, eine zufällige Gerätekennung (damit ein Gerät seine eigenen Einträge erkennt) und unlesbare Blöcke. Deine PIN und der Wiederherstellungscode verlassen das Gerät nie. Umweltdaten lädt jedes Gerät selbst.

**Gleichzeitige Änderungen:** Messwerte zweier Geräte werden vereinigt. Beim Check-in gilt je Zeitpunkt (Morgen, Abend) das zuletzt gespeicherte Gerät. Im Logbuch bleiben die Einträge beider Geräte erhalten (Glas hier, Kaffee dort), Gelöschtes bleibt gelöscht; bei Glück, Arbeitszeit und Tagebuchtext gilt die letzte Änderung. Bei Einstellungen gilt die letzte Änderung.

Nach dem Update auf 0.5 holt jedes verbundene Gerät einmal alle Einträge neu, damit Logbuch-Tage ankommen, die eine ältere Version übersprungen hat. Das dauert beim ersten Öffnen etwas länger und verbraucht einmalig Lesevorgänge; doppelt wird dabei nichts.

### Einrichten (einmalig, etwa 15 Minuten, kostenlos)

Das macht nur die Person, die die App auf GitHub betreibt. Freunde brauchen danach nichts einzurichten.

1. Auf [console.firebase.google.com](https://console.firebase.google.com) mit einem Google-Konto anmelden, **Projekt erstellen**, Name zum Beispiel `formkurve`. Google Analytics ist nicht nötig. Der kostenlose Spark-Tarif reicht; keine Zahlungsdaten angeben.
2. **Authentication → Jetzt starten → Anmeldemethode → E-Mail/Passwort** aktivieren und speichern. Unter **Vorlagen** lässt sich die Sprache der E-Mails auf Deutsch stellen.
3. **Firestore Database → Datenbank erstellen**, Standort zum Beispiel `europe-west3 (Frankfurt)` (lässt sich später nicht ändern), im Produktionsmodus starten. Dann im Tab **Regeln** diese Regeln einfügen und **Veröffentlichen**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

4. **Projekteinstellungen** (Zahnrad) → **Allgemein** → **Meine Apps** → Web-App hinzufügen (Symbol `</>`), Name `Formkurve`, Firebase Hosting nicht nötig. Firebase zeigt einen Abschnitt `const firebaseConfig = { … }`; daraus brauchst du `apiKey` und `projectId`.
5. Im GitHub-Repository **Add file → Create new file**, Dateiname `sync-config.js`, Inhalt:

   ```js
   window.FORMKURVE_SYNC = {
     apiKey: 'DEIN-API-KEY',
     projectId: 'DEINE-PROJEKT-ID',
   };
   ```

   **Commit changes.** Einfacher: den ganzen `firebaseConfig`-Abschnitt in der App unter **Profil → Konto → Online-Konten einrichten** einfügen; die App prüft ihn und zeigt den fertigen Dateiinhalt zum Kopieren.
6. Nach ein bis zwei Minuten zeigt die Startseite **Mit Online-Konto anmelden**.

`apiKey` und `projectId` sind nicht geheim; den Zugriff regeln die Regeln aus Schritt 3 und die Anmeldung. Wer mag, beschränkt den Schlüssel in der Google Cloud Console (APIs & Dienste → Anmeldedaten) auf die eigene GitHub-Pages-Adresse.

**Kostenlose Grenzen (Spark-Tarif):** Firestore 1 GiB Speicher, 50.000 Lesevorgänge, 20.000 Schreibvorgänge und 20.000 Löschvorgänge am Tag, 10 GiB Datenübertragung im Monat; Firebase Authentication bis zu 150 E-Mails zum Zurücksetzen des Passworts am Tag. Ein Jahr Messwerte sind einige Tausend Einträge; für dich und ein paar Freunde reicht das deutlich. Wird ein Tageskontingent erreicht, gleicht die App am nächsten Tag weiter ab; nichts geht verloren.

## Konto anlegen

1. App öffnen → **Neues Konto anlegen** → Name und PIN (4 bis 8 Ziffern). Keine E-Mail, kein Passwort.
2. Die App zeigt einmalig einen **Wiederherstellungscode** (16 Zeichen). Ihn im Passwort-Manager oder in Notizen sichern. Damit setzt du eine neue PIN, falls du sie vergisst.
3. Wenn Online-Konten eingerichtet sind: **Auf mehreren Geräten nutzen** mit E-Mail und Passwort, oder „Später“.
4. **Standort erlauben** oder „Später“.
5. Optional Geburtsjahr, Geschlecht, Größe und Gewicht. Alles lässt sich überspringen und später unter **Profil → Körperdaten** nachtragen.

„Auf diesem Gerät angemeldet bleiben“ ist vorausgewählt. **Profil → Konto** bietet Abmelden, PIN ändern, einen neuen Wiederherstellungscode und Konto löschen. Nach fünf falschen PINs wartet die App erst 30 Sekunden, danach jeweils doppelt so lange, höchstens 15 Minuten. Wer erst schauen will, tippt auf **Ohne Konto ausprobieren**.

## Wo die Daten liegen

- **Lokal, verschlüsselt.** Jedes Konto hat eine eigene Datenbank im Speicher der Web-App (IndexedDB), Inhalte mit AES-GCM (256 Bit) verschlüsselt. Den Schlüssel sichern die PIN (PBKDF2-SHA-256, 310.000 Runden) und der Wiederherstellungscode.
- **Abgleich nur mit Online-Konto.** Ohne Online-Konto bleibt alles auf dem einen Gerät; für ein neues iPhone dann **Profil → Backup und Löschen → Backup exportieren**, dort ein Konto anlegen und **Backup laden**.
- **Warum Firebase und nicht GitHub?** GitHub Pages liefert nur die App-Dateien aus. Um Daten in ein Repository zu schreiben, bräuchte die App einen Zugangsschlüssel, der im öffentlichen Code für alle lesbar wäre. Firebase bietet Anmeldung mit E-Mail und eine Datenbank kostenlos, und die Mails zum Zurücksetzen des Passworts erreichen alle Nutzer.
- **Home-Bildschirm nutzen.** Safari löscht die gespeicherten Daten einer Website, wenn du sie an sieben Tagen mit Safari-Nutzung nicht besucht hast. Web-Apps auf dem Home-Bildschirm zählen laut WebKit nur ihre eigenen Nutzungstage und sollen ihre Daten behalten. Safari und die Home-Bildschirm-App haben getrennte Speicher, also auch getrennte Konten.
- **Grenzen der PIN.** Die PIN schützt vor anderen Personen am selben Gerät. Den eigentlichen Schutz liefert die Gerätesperre des iPhones; wer mehr will, nimmt eine 8-stellige PIN.

## Aufbau der App

Unten stehen vier Reiter: **Heute**, **Logbuch**, **Verlauf** und **Profil**.

- **Check-in-Knopf:** Er schwebt unten rechts in jedem Reiter und öffnet den Check-in als Blatt über der aktuellen Ansicht. Ist ein Check fällig, steht „Morgencheck“ oder „Abendcheck“ darauf. Ein gelbes Abzeichen zeigt, wie viele Checks im Nachtragefenster noch offen sind (Morgen und Abend je Tag, sobald der Zeitpunkt vorbei ist); ein Tippen öffnet den ältesten davon. Beim Herunterscrollen schrumpft er auf das Symbol. Schließen geht über das X oder die Escape-Taste; angefangene Antworten bleiben bis zum Speichern erhalten, auch nach einem Abstecher ins Logbuch. Zwischen Mitternacht und 4 Uhr gehört der Abendcheck noch zum Vortag, wie im Logbuch.
- **Profil:** oben das Konto und eine Karte mit den Einsichten, darunter je eine eigene Seite für **Daten importieren**, **Körperdaten**, **Umwelt und Standort**, **Backup und Löschen**, **Einstellungen** und **Über Formkurve**. Jede Unterseite hat oben einen Pfeil zurück zur Übersicht und eine eigene Adresse, etwa `#profil/konto`.
- **Täglicher Import ohne Umweg:** Fehlt auf „Heute“ die letzte Nacht oder sind die Daten älter als 20 Stunden, steht oben ein Hinweis mit **Einfügen und importieren**.
- **Tag oder Monat:** Über dem Titel auf „Heute“ steht ein Umschalter. Siehe den nächsten Abschnitt.

## Farben und Karten

**Profil → Einstellungen → Farben:** zwei Varianten, unabhängig von hell und dunkel.

| Variante | Sieht aus wie |
| --- | --- |
| **Rot** (Standard) | Weiß mit Rottönen, Zeiger und Knöpfe in Rot – der Entwurf im Stil von Apple Health |
| **Schiefer** | das ruhige Nachtblau der ersten Versionen |

Semantische Farben bleiben in beiden Varianten gleich: Grün heißt gut, Gelb Vorsicht, Rot kritisch.

**Profil → Einstellungen → Karten auf „Heute“:** acht Karten lassen sich einzeln abschalten – Ringe, Tagesform im Schnitt, Was deine Recovery bewegt, Hinweise, Letzte Nacht, Schlaf, Belastung und Umwelt. Die Tagesform selbst und die Karten für Import, Check-in und Frühwarnungen bleiben immer.

Karten, für die gar keine Messwerte ankommen, erkennt die App aus der Datenprüfung und bietet sie oben in der Liste zum Ausblenden an („Diese ausblenden“ schaltet alle auf einmal ab). Steht eine solche Karte leer auf „Heute“, steht neben dem Hinweis direkt ein **Karte ausblenden**. Kommt der Wert später doch, schaltest du sie in den Einstellungen wieder ein.

## Kurze Karten, ganze Seiten

Auf „Heute“ steht in jeder Karte nur das Nötigste: der Wert, der zählt, und Warnungen. Oben rechts in der Ecke öffnet ein Knopf dieselbe Karte als **ganze Seite** mit allen Einzelheiten – oder direkt über die Adresse, etwa `#heute/sleep`.

| Karte | Kurz | Auf der Seite |
| --- | --- | --- |
| Letzte Nacht | HRV und Ruhepuls, Auffälliges in einem Satz | alle fünf Werte, ausführliche Erklärung |
| Schlaf | geschlafen, was zum Bedarf fehlt | Effizienz, Tiefschlaf, REM, Latenz, Regelmäßigkeit, nächtliche Ruhe, Rechnung des Bedarfs |
| Belastung | Last und Schritte | Kraft-Zuschlag, Aktivminuten, 7 zu 28 Tage, Energie, Fitness, Trainings des Tages |
| Letzte Trainings | die letzten vier | bis zu 40, mit Erklärung |
| Was deine Werte bewegt | die drei stärksten Anteile, Deckel-Warnung, Logbuch-Summe | alle Anteile, Rechnung der Tagesform, alle Gründe |
| Hinweise | nur Warnungen, höchstens zwei | alle Hinweise mit Text |
| Umwelt | Nachttemperatur, Feinstaub und Pollen nur bei Auffälligkeit | Luftfeuchte, Höchstwert, Tageslänge |
| Tagesform im Schnitt | Durchschnitt und Unterschied zur Vorwoche | Diagramm, Tabelle, Wochen oder Monate |

Der Zurück-Pfeil führt auf „Heute“; welche Karten überhaupt erscheinen, bleibt unter **Profil → Einstellungen → Karten auf „Heute“** einstellbar.

## Der Monatskalender

**Heute → Monat** zeigt den ganzen Monat als Raster von Montag bis Sonntag. Jeder Tag bekommt eine Farbe nach seinem Wert, wie eine Farbskala bei bedingter Formatierung in einer Tabelle. So fallen gute und schlechte Strecken sofort auf, und ein Tippen auf einen Tag öffnet ihn in der Tagesansicht.

- **Werte zur Auswahl:** Tagesform, Recovery, Schlaf, Strain und Glück. Die Wahl bleibt gespeichert.
- **Fünf Stufen:** Bei Tagesform, Recovery, Schlaf und Glück geht die Skala von Rot über Gelb nach Grün; die Grenzen liegen an den Schwellen aus den Einstellungen (Standard: unter 34 rot, ab 67 grün) und je einer Mitte darunter und darüber. Die Grenzen stehen unter dem Raster. Strain ist weder gut noch schlecht und läuft deshalb von hell nach kräftig.
- **Blättern:** Mit den Pfeilen oben einen Monat vor oder zurück, bis zum ersten Tag mit Daten. Unter dem Titel steht der Monatsdurchschnitt, unter dem Raster dazu der Unterschied zum Vormonat sowie der höchste und niedrigste Tag.
- **Markierungen:** Heute ist unterstrichen, der gewählte Tag umrandet. Ein gelber Punkt heißt, dass an dem Tag noch ein Check-in offen ist; Tage ohne Daten und künftige Tage bleiben grau.
- Auf sehr schmalen Bildschirmen (unter 360 Pixel) zeigen die Felder nur das Datum, die Farbe bleibt.

## Tagesform im Schnitt und Wochenenden

- **Heute → Tagesform im Schnitt:** Säulen mit dem Durchschnitt je Kalenderwoche (Montag bis Sonntag) oder je Monat, die letzten zwölf. Darüber der aktuelle Abschnitt mit dem Unterschied zum vorherigen; ein Tippen auf eine Säule zeigt Zeitraum, Anzahl der Tage und die Spanne. Die laufende Woche oder der laufende Monat ist heller. Auch als Tabelle.
- **Verlauf:** In allen Diagrammen sind Samstag und Sonntag farbig hinterlegt. Nachtwerte zählen zum Tag des Aufwachens; eine Freitagnacht erscheint also beim Samstag.

## Das Logbuch

Der Reiter **Logbuch** hält fest, was das Band nicht misst. Auf **Heute** steht eine kleine Karte mit den Werten des Tages und den Knöpfen **+ Glas Wasser** und **+ Kaffee** (oder dem Getränk, das du am häufigsten einträgst).

| Bereich | Eintragen | Richtwert im (i) |
| --- | --- | --- |
| Wasser | Glas oder Flasche mit einem Tippen, andere Mengen in 50-ml-Schritten | D-A-CH-Referenzwerte (DGE): 1,41 l aus Getränken mit 25 bis 50 Jahren; EFSA: 2,0 l (Frauen) und 2,5 l (Männer) Wasser insgesamt, also mit Essen |
| Koffein | Kaffee, Espresso, Cappuccino, Tee, Cola, Energydrink, Pre-Workout; Milligramm nach BfR, wo es einen Richtwert gibt, je Eintrag änderbar | EFSA: bis 400 mg am Tag, bis 200 mg auf einmal; schon 100 mg kurz vor dem Schlafen können stören |
| Glück | „Wie glücklich hast du dich heute insgesamt gefühlt?“, 0 bis 10 | Stufen des britischen Statistikamts ONS: 0–4 niedrig, 5–6 mittel, 7–8 hoch, 9–10 sehr hoch |
| Sport | Einheiten, die das Band nicht erfasst hat (Art, Dauer, Anstrengung); gemessene Workouts erscheinen von selbst | WHO: 150–300 min moderat oder 75–150 min intensiv pro Woche, Krafttraining an 2 Tagen |
| Arbeit | Stunden ohne Pausen, Schnellwahl frei, 4, 6, 8, 9, 10 h | Arbeitszeitgesetz: 8 h je Werktag, bis 10 h, 11 h Ruhe; WHO und ILO: ab 55 h pro Woche höheres Risiko für Schlaganfall und Herzkrankheit |
| Tagebuch | freier Text, speichert beim Tippen | — |

- **Ein Logbuch-Tag geht bis 4 Uhr früh.** Der Kaffee um halb eins zählt noch zum Vortag und gilt dort als „spät“.
- **Nachtragen:** oben mit den Pfeilen zum Vortag. Über den Stift neben jedem Eintrag änderst du Uhrzeit oder Menge oder löschst ihn; nach dem Eintragen und Löschen gibt es kurz **Rückgängig**.
- **Sport zählt nicht doppelt:** Passt ein Eintrag zeitlich (bis 30 Minuten daneben) zu einem gemessenen Workout derselben Art, gilt er als dieselbe Einheit: Dauer aus der Messung, Anstrengung aus dem Logbuch. Spaziergänge zählen zur Bewegung, aber nicht als Training.
- **Rückblick:** Diagramme für 14, 30 oder 90 Tage mit hinterlegten Wochenenden und Tabellenansicht, Durchschnittswerte, eine Tabelle „Wochen im Überblick“ und alle Tagebucheinträge mit Suche.
- **Einstellungen** unten im Logbuch oder unter **Profil → Einstellungen**: Trinkziel (Startwert 2 l), Größe von Glas und Flasche, Karte auf „Heute“ ein- oder ausblenden.

**Zusammenspiel mit dem Abendcheck:** Was im Logbuch steht, fragt der Abendcheck nicht noch einmal. Mit Wasser im Logbuch entfällt „Getrunken“, mit Koffein (oder „Heute kein Koffein“) die Koffein-Fragen, mit einer Trainingseinheit die Trainingsfragen; die Anstrengung fragt er nur, wenn sie im Logbuch fehlt. Oben im Abendcheck steht dann „Aus dem Logbuch“ mit einem Link zum Ändern. Die frühere Notiz im Abendcheck ist ins Tagebuch gewandert.

**In den Einsichten** (Profil → Einsichten) ist Glück ein eigener Zielwert (Filter „Glück“): Die App vergleicht Tage mit und ohne Sport, mit gutem und schlechtem Schlaf, mit langen Arbeitstagen, Stress, Natur, Tageslicht und mehr, jeweils am selben Tag, und Alkohol mit dem Glück am Tag danach. Dazu kommen Faktoren für die Nacht: lange Arbeitstage (ab 9 h), mehr als 300 mg Koffein und sehr glückliche Tage.

## Der Check-in

Der Check-in öffnet sich über den schwebenden Knopf unten rechts (siehe „Aufbau der App“) oder über die Karten auf „Heute“. Morgens und abends gibt es zuerst wenige **Kernfragen**, danach **optionale Fragen**, die wichtigsten zuerst.

| | Kernfragen | Folgefragen bei Bedarf |
| --- | --- | --- |
| Morgen | Erholung, Schlafgefühl, Muskelkater, Krankheitsgefühl | — |
| Abend | Stress, Alkohol, Koffein, Training | Anzahl Getränke, Uhrzeit des letzten Koffeins, Trainingsart, Dauer, Anstrengung |

Was du schon im Logbuch eingetragen hast, fällt abends weg (siehe oben). Supplements werden zur Kernfrage, sobald du in den letzten 14 Tagen welche angegeben hast; Nikotin und Cannabis, wenn du sie in den Einstellungen einschaltest. Die optionalen Fragen sind nach ihrer erwarteten Wirkung auf HRV, Ruhepuls und Schlaf sortiert: abends zum Beispiel besondere Ereignisse, Supplements, letzte Mahlzeit, Erholungsmaßnahmen, Bildschirm vor dem Schlafen. Ernährungs-, Stress- und Schlafumgebungsfragen rücken an ihren Vorschlagstagen nach vorn, der Wochenrückblick erscheint nur am gewählten Tag.

**Profil → Einstellungen → Anzeige und Check-in → Umfang:** „Kurz“ zeigt nur die Kernfragen, „Standard“ dazu die drei wichtigsten optionalen, „Ausführlich“ alle. Der Rest liegt immer hinter **Weitere Fragen**. Unbeantwortet bleibt leer und zählt nicht als „Nein“.

**Supplements:** über 50 Mittel in fünf Gruppen (Schlaf und Entspannung, Training und Leistung, Vitamine, Mineralstoffe, Weitere), mit Suche und eigenen Einträgen. Zuletzt genutzte stehen oben und sind vom Vortag vorbelegt. Die Einsichten vergleichen für jedes Mittel Tage mit und ohne.

## Standort und Umweltdaten

- Beim Anlegen „Standort erlauben“ oder später **Profil → Umwelt und Standort → Standort automatisch**.
- Die Koordinate wird auf etwa 1 km gerundet und nur auf dem Gerät gespeichert. Nur diese gerundete Koordinate geht an Open-Meteo.
- Beim ersten Mal lädt die App 92 Tage rückwirkend. Bei jedem Öffnen prüft sie still den Standort, wenn die Erlaubnis besteht; ab 25 km Abstand gilt der neue Ort. Wetter lädt sie höchstens alle drei Stunden neu.
- Ohne Standort-Erlaubnis: **Ort lieber von Hand wählen**.

## Infopunkte mit Normalwerten

Jeder Wert im Dashboard hat ein (i) mit dem allgemeinen Normal- oder Richtwert, der Quelle und der Einordnung deines Werts. Ein Etikett zeigt die Herkunft: offizielle Stelle (WHO, NHS, Royal College of Physicians, National Sleep Foundation, American Heart Association, Deutscher Wetterdienst, DGE mit den D-A-CH-Referenzwerten, EFSA, Bundesinstitut für Risikobewertung, britisches Statistikamt ONS, Arbeitszeitgesetz, WHO und ILO), Studie, Fachliteratur oder eigene Formkurve-Berechnung. Die Tabelle mit allen Werten steht im Konzeptdokument (Abschnitt 12).

## So kommen die Daten in die App

| Weg | Wofür | Wie |
| --- | --- | --- |
| Apple-Health-Export | Historie, Lücken nachholen | Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“ → in Dateien sichern → in Formkurve unter **Profil → Daten importieren → Apple-Health-Export wählen** |
| Kurzbefehl „Formkurve Sync“ | täglich | Kurzbefehl ausführen → Formkurve öffnen → auf **Heute** im Hinweis **Einfügen und importieren** (sonst **Profil → Daten importieren**) |

Auf **Heute** zeigt die Karte „Belastung“ die **aktive Energie** des Tages in kcal (ohne Grundumsatz, wie Apple Health) und bei jedem Training die verbrannten kcal. Dafür muss Zepp „Aktive Energie“ an Apple Health schreiben.

Die Anleitung für den Kurzbefehl steht in [KURZBEFEHL.md](KURZBEFEHL.md) und in der App unter **Profil → Daten importieren**. Importe landen immer im gerade angemeldeten Konto. Vorher in der Health-App unter Profilbild → Apps → Zepp alle Kategorien freigeben.

## Frühwarnungen

Auf „Heute“ erscheint eine Karte, wenn sich deine Werte über mehrere Tage von deinen eigenen entfernen. Grundlage ist das Konzeptdokument „Frühwarnsystem für Formkurve“. Abschaltbar unter **Profil → Einstellungen → Frühwarnungen**, alle Grenzen unter **Modell und Gewichte** änderbar.

| Warnung | Löst aus bei | Empfehlung im Text |
| --- | --- | --- |
| Beginnender Infekt | Ruhepuls und Atemfrequenz über, HRV unter deiner Baseline (1,5 σ), mindestens 2 der 3 Werte, 2 Nächte nacheinander | Schonen; bei Fieber, Atemnot oder mehr als 3 bis 5 Tagen zum Hausarzt |
| Ruhepuls dauerhaft hoch | 7-Tage-Median über 100 bpm, oder 8 bpm über der 90-Tage-Baseline über zwei Wochen | Hausarzt: Blutdruck, Schilddrüse, Blutbild |
| Blutsauerstoff nachts niedrig | Nächtlicher Median unter 90 % in mindestens 3 von 7 Nächten | Hausarzt oder Schlafmedizin, auch wegen Schlafapnoe |
| Schlaf chronisch kurz | Unter 6 h in mindestens 4 von 7 Nächten, und das 3 Wochen hintereinander | Schlafhygiene, danach Hausarzt |
| Stimmung dauerhaft niedrig | Glück 4 oder weniger an mindestens 10 von 14 Tagen | Hausarzt oder psychotherapeutische Sprechstunde, dazu die Telefonseelsorge |

**Die Regeln dahinter:**

- **Dauer statt Ausreißer.** Keine Warnung nach einer einzigen Nacht.
- **Störfaktoren zählen.** Alkohol im Logbuch oder ein harter Trainingstag davor machen aus der Infektwarnung eine Beobachtung („kann auch an … liegen“). Ein Krankheitsgefühl im Morgencheck hebt sie wieder an.
- **Erst mit Verlauf.** Warnungen, die auf der Baseline beruhen, brauchen mindestens 14 Vergleichsnächte. Ohne Historie bleibt es still.
- **Pause.** „Verstanden“ legt denselben Hinweis 7 Tage schlafen; die Pause gilt auch nach einem Neustart.
- **Keine Diagnose.** Die Texte benennen Abweichungen und raten zur ärztlichen Abklärung. In der Karte steht fest, dass bei Brustschmerz, Atemnot oder Ohnmacht der Notruf 112 gilt.
- **Nicht umgesetzt:** Herzrhythmusstörungen (braucht ein zertifiziertes EKG) und Fieber (braucht verlässliche Hauttemperatur).
- In den Beispieldaten erscheinen keine Warnungen, damit erfundene Werte niemanden beunruhigen.

## Datenprüfung: was fehlt und was deshalb nicht geht

**Profil → Daten importieren → Datenprüfung** listet jeden Messwert mit seinem Zustand und, wenn er fehlt, mit der Folge. Vier Zustände:

| Zustand | Heißt |
| --- | --- |
| Zahl und Zeitraum | kommt an und ist aktuell |
| „keine neuen Werte seit …“ | kam früher, fehlt aber seit mehr als 3 Tagen |
| „fehlt“ | nie angekommen, und es kostet eine Berechnung |
| „kommt an, ließ sich aber nicht lesen“ | Werte waren da, lagen aber außerhalb des Messbereichs oder hatten kein lesbares Datum oder keine Zahl |

Darunter steht, welche Berechnungen gerade nicht laufen und was ihnen fehlt, und getrennt davon, was nur noch auf Verlauf wartet (Recovery und Tagesform brauchen erst Vergleichsnächte). Verworfene Werte nennt die App mit Grund und Messbereich, etwa „40 außerhalb des Messbereichs (70–100 %)“; unbekannte Typen aus dem Kurzbefehl stehen mit Namen da.

Ein fehlender Wert ist nicht immer ein Fehler: Hauttemperatur, Körpertemperatur und Apples eigener Ruhepuls fehlen bei vielen Geräten, ohne dass etwas ausfällt. Solche Zeilen bleiben grau und lösen keine Meldung aus.

**Auf „Heute“** erscheint eine Meldung nur, wenn ein fehlender Wert wirklich eine Berechnung kostet; sie nennt die betroffenen Berechnungen und führt zur Prüfung. „Ausblenden“ merkt sich den Zustand, bis er sich ändert — fällt später ein weiterer Wert aus, meldet sie sich wieder. Ganz abschaltbar unter **Profil → Einstellungen → Hinweis bei fehlenden Messwerten**.

Die wichtigsten Abhängigkeiten:

| Fehlt | Dann fehlt |
| --- | --- |
| Herzfrequenz | Strain und Last, Aktivminuten, Belastungsbalance, Ruhepuls aus dem Schlaf |
| Schlafanalyse | Schlaf-Score, Schlafbedarf, Tiefschlaf und REM — und das Nachtfenster, also auch der Ruhepuls |
| HRV | der HRV-Anteil der Recovery; zusammen mit fehlendem Nachtpuls auch Recovery und Tagesform |
| Atemfrequenz, Blutsauerstoff, Hauttemperatur | je ein Teil des Vitalanteils; fehlen alle drei, fällt er ganz weg |
| Blutsauerstoff | die Frühwarnung „Blutsauerstoff niedrig“ |
| Schritte, Aktive Energie, VO₂max, Gewicht | nur die jeweilige Anzeige |

### Wenn die Tagesform leer bleibt

Schlaf-Score und Strain stehen oft schon da, während Tagesform und Recovery noch „–“ zeigen. Das ist kein Importfehler, sondern Absicht:

| | braucht |
| --- | --- |
| Schlaf-Score, Strain | nur die Nacht beziehungsweise den Tag selbst |
| Recovery | je Nacht **HRV oder Ruhepuls** und dazu **mindestens 5 Nächte davor** zum Vergleich (ab 14 gilt der Vergleich als eingespielt) |
| Tagesform | die Recovery dieses Tages |

Recovery misst keinen absoluten Wert, sondern den Abstand zu deinen eigenen Nächten. Ohne Vergleich gibt es deshalb keine Zahl. Die App schreibt den Grund direkt unter die Tagesform-Anzeige: fehlende Nachtwerte oder zu kurzer Vergleich.

**Nachsehen:** **Profil → Daten importieren → Die letzten Nächte** listet die letzten 14 Nächte mit HRV, Ruhepuls, Schlafdauer, der Zahl der Vergleichsnächte („Vgl.“) und der Recovery. Damit ist sofort sichtbar, ob ein Wert gar nicht ankommt oder nur die Geschichte fehlt. Darunter prüft die App selbst, ob die HRV im Schlaffenster liegt oder erst am Vortag, und sagt, ob der HRV-Tagesversatz richtig steht.

- **Eine Spalte durchgehend „fehlt“:** Der Wert kommt nicht aus Apple Health. In der Health-App unter Profilbild → Apps → **Zepp** alle Kategorien freigeben, in der Zepp-App synchronisieren und erst dann neu exportieren.
- **Ruhepuls:** Er stammt aus dem Puls im Schlaf (10. Perzentil); ein Stern in der Tabelle heißt, dass er aus dem Feld „Ruhepuls“ von Apple Health kommt. Dafür müssen Pulswerte in der Schlafphase liegen.
- **Nur wenige Vergleichsnächte:** Ein Apple-Health-Gesamtexport bringt die Historie auf einen Schlag mit (bis 400 Tage zurück); der Kurzbefehl liefert nur die letzten Tage.
- **HRV landet einen Tag zu früh:** Die Zeile unter der Tabelle sagt es. Dann unter **Beim Import** den HRV-Tagesversatz auf „+1 Tag“ stellen. Die Prüfung liest die Rohdaten und gilt unabhängig davon, wie der Schalter gerade steht.

## Sport: erkennen, eintragen, nachlesen

### „War das Sport?“

Lag dein Puls über längere Zeit erhöht, ohne dass ein Training eingetragen ist, fragt eine Karte auf „Heute“ nach. Erkannt wird ein Abschnitt, wenn der Puls mindestens 12 Minuten über deinem Ruhepuls + 30 bpm (oder über 55 % des Maximalpulses) liegt; Pausen bis 5 Minuten überbrückt die App, Schlafzeiten und bereits bekannte Trainings lässt sie aus. Die Karte zeigt Zeitraum, Dauer, Ø- und Höchstpuls, Schritte je Minute und Energie – daraus wird die Art geschätzt.

Du kannst alles ändern: die **Sportart** aus 33 Arten in fünf Gruppen (Ausdauer, Kraft und Studio, Ballsport, Beweglichkeit, Alltag), den **Zeitraum** über Von und Bis. **Eintragen** schreibt die Einheit ins Logbuch, **Kein Sport** merkt sich den Zeitraum und fragt nicht wieder.

Zum Ballsport gehören Fußball, Basketball, Volleyball, Handball, Tennis, Tischtennis, Badminton, Squash, Padel, Hockey und Golf. Unter Alltag stehen auch Hausarbeit, **Intimität** und **Stress, Aufregung** — erhöhter Puls hat nicht immer mit Sport zu tun, und was die App als das erkennt, was es war, verfälscht die Last nicht. Intimität lässt sich unter **Profil → Einstellungen → Intimität zur Auswahl anbieten** ausblenden; sie und Stress zählen nicht ins Trainingspensum.

### Die Schätzung lernt mit

Jede Sportart hat Startwerte für Puls, Dauer, Schritte je Minute und Tageszeit. Trägst du eine Einheit ein, wandern die Werte dieser Art auf deine eigenen zu; nach etwa zehn Einträgen zählt fast nur noch, was du selbst eingetragen hast. So unterscheidet die App mit der Zeit dein Krafttraining von deinem Fußball, auch wenn der Puls ähnlich aussieht. Auch die vorgeschlagene Dauer mischt sich aus Messung (65 %) und deiner Gewohnheit (35 %).

Das Gelernte liegt in den Einstellungen und gleicht sich mit deinen Geräten ab. **Profil → Einstellungen → Gelerntes zurücksetzen** zeigt, wie viele Arten die App aus wie vielen Einträgen kennt, und beginnt auf Wunsch von vorn.

### Was die Erkennung zusammenfasst

Zwei Abschnitte mit weniger als 15 Minuten Pause dazwischen gelten als eine Einheit: Hantelbank, zehn Minuten reden, weiter. Die Karte nennt die Pause, damit die Zusammenfassung nachvollziehbar bleibt.

### Zusammenfassung einer Einheit

Ein Tipp auf eine Trainingszeile unter **Belastung** öffnet die Zusammenfassung: Zeitraum und Quelle, Dauer, Ø- und Höchstpuls, Schritte im Zeitraum, Energie, die Last dieser Einheit und die Zeit in den sechs Pulszonen als Balken und Liste.

## Wie Schlaf, Erholung und Logbuch zusammenhängen

### Schlafbedarf

Der Bedarf ist keine feste Zahl, sondern wächst mit dem, was hinter dir liegt:

| Teil | Wirkung |
| --- | --- |
| Grundbedarf | aus den Körperdaten, Standard 8,0 h |
| Schlafschuld der letzten drei Nächte | 25 % des Fehlbetrags |
| Belastung | Strain über 40 am Vortag (voll) und am Tag davor (zur Hälfte) |
| Schwache Erholung | Recovery der letzten zwei Nächte unter 55, je Punkt 0,012 h |
| Mittagsschlaf | zieht bis zu 1 h ab |

Der Mehrbedarf ist zusammen auf 2,5 h gedeckelt. Zwei Nächte Party mit wenig Schlaf, hohem Strain und schwacher Erholung heben ihn also deutlich – in der Schlafkarte steht die Rechnung aufgeschlüsselt: „Bedarf 9:45 h = 8:00 h Grundbedarf + 1,0 h Schlafschuld + 0,5 h für die Belastung davor + 0,3 h für die schwache Erholung“.

### Warum eine durchzechte Nacht die Tagesform nicht rettet

Bis Version 0.9 zählte der heutige Tag nur zur Hälfte in die Tagesform, und Belastungsbalance und Langzeit-Fitness (zusammen 30 %) ändern sich kaum. Nach einer kurzen Nacht mit Alkohol konnte die Tagesform deshalb höher liegen als an einem normalen Tag davor — die langsamen Teile trugen darüber hinweg. Seit 0.10 gilt:

| | vorher | jetzt |
| --- | --- | --- |
| Heute zählt | 50 % | 60 % |
| Recovery | 45 % | 50 % |
| Belastungsbalance | 15 % | 10 % |
| **Deckel** | — | Liegt die Recovery heute unter 40, kann die Tagesform höchstens 15 Punkte darüber liegen |

Dazu zieht ein verschobener Rhythmus Punkte: Gehst du 1,5 h später schlafen als sonst −2, ab 3 h später −4. Beides steht mit Begründung in der Karte **Was deine Werte bewegt**, die jetzt auch zeigt, **woraus die Tagesform entsteht** — jeder Anteil mit Wert und Gewicht, und ob der Deckel gegriffen hat.

### Warum Schlaf-Score und Recovery auseinanderlaufen können

Der Schlaf-Score bewertet den **Schlaf**, die Recovery den **Zustand am Morgen**. Lange und durchgehend zu schlafen heißt nicht, dass die Nacht erholsam war. Damit der Score das nicht übersieht, zählt seit Version 0.9 ein fünfter Anteil mit:

| Anteil | Gewicht | Woraus |
| --- | --- | --- |
| Dauer | 0,35 | geschlafene Zeit gegen den Bedarf |
| Effizienz | 0,18 | Schlafzeit gegen Zeit im Bett |
| Tiefschlaf und REM | 0,17 | Anteil erholsamer Phasen |
| Regelmäßigkeit | 0,15 | Streuung von Einschlaf- und Aufwachzeit über 7 Tage |
| **Nächtliche Ruhe** | 0,15 | HRV über und Ruhepuls unter deiner Baseline |

Fällt die nächtliche Ruhe niedrig aus, während der Rest stimmt, schreibt die App es in die Schlafkarte: lang geschlafen, aber unruhig. Ohne Baseline bleibt der Anteil leer und die übrigen werden neu gewichtet. Ein Rest Überschneidung bleibt bewusst: HRV und Puls zählen über diesen Anteil mit etwa 3 % ein zweites Mal in die Recovery hinein.

### Logbuch in der Tagesform

Alkohol, Koffein und Wasser wirken auf HRV, Puls und Schlaf – und stecken damit schon in den Messwerten. Trotzdem zählen sie zusätzlich mit, aber klein und immer mit Begründung:

| Eintrag | Punkte |
| --- | --- |
| Alkohol am Abend davor | −3, je weiteres Getränk −1, höchstens −5 |
| Letztes Koffein nach 17 Uhr | −2 |
| Mehr als 400 mg Koffein | −1 |
| Unter 60 % des Trinkziels | −2 |
| Trinkziel erreicht | +1 |

Zusammen höchstens −6 und +1 auf die Tagesform. Die Gründe stehen auf „Heute“ unter **Was deine Werte bewegt**. Abschaltbar unter **Profil → Einstellungen → Logbuch zählt zur Tagesform**, alle Punkte änderbar unter **Modell und Gewichte**.

### Störfaktoren an den Nachtwerten

Fällt ein Nachtwert um mehr als eine Standardabweichung aus dem Rahmen, sucht die App nach einer bekannten Erklärung und schreibt sie unter die Werte:

| Erklärung | Betrifft |
| --- | --- |
| Alkohol am Abend davor | Ruhepuls, HRV |
| Hartes Training am Tag davor (Strain ab 70) | Ruhepuls, HRV, Atemfrequenz |
| Letztes Koffein nach 17 Uhr | HRV |
| Nacht unter 5 Stunden | Ruhepuls, HRV |

Dieselbe Liste benutzt die Infektwarnung: Gibt es eine Erklärung und kein Krankheitsgefühl, bleibt es eine Beobachtung statt einer Warnung, und der Text nennt den Grund samt Größenordnung („Alkohol hebt den Ruhepuls typischerweise um 5 bis 10 bpm“). Steht im Logbuch nichts, sagt die App auch das.

### Gewicht über die Zeit

**Profil → Körperdaten → Gewicht** nimmt einzelne Messungen mit Datum entgegen, statt einen festen Wert zu überschreiben. Jede Eingabe wird wie ein Messwert aus Apple Health gespeichert, gleicht sich also mit anderen Geräten ab und erscheint in der Datenprüfung. Darunter stehen der Verlauf der letzten 90 Tage, die letzte Messung und die Veränderung gegenüber den 30 Tagen davor; im Reiter **Verlauf** gibt es dieselbe Kurve über den gewählten Zeitraum. Eine Waage, die an Health schreibt, füllt den Verlauf von selbst. Zwischen zwei Messungen gilt die letzte, längstens 21 Tage.

## Täglicher Ablauf

1. Morgens: Kurzbefehl ausführen, Formkurve öffnen, auf „Heute“ **Einfügen und importieren** tippen.
2. Morgencheck über den Knopf unten rechts: vier Kernfragen, etwa 20 Sekunden. Erst danach zeigt die App die Scores, damit die Zahl dein Gefühl nicht beeinflusst.
3. Über den Tag: Wasser und Kaffee mit einem Tippen auf „Heute“ oder im Logbuch eintragen, Sport ohne Band dort ergänzen.
4. Abends: Glück, Arbeitszeit und ein paar Zeilen Tagebuch im Logbuch, dann der Abendcheck, etwa 30 Sekunden; was im Logbuch steht, fragt er nicht mehr. Erinnern kann eine Kurzbefehl-Automation „Tageszeit 21:00 → Mitteilung anzeigen“.
5. Nach etwa 6 Wochen werden die Einsichten belastbar.

## Die Nacht im Detail

Ein Tipp auf den Balken eines Werts unter **Letzte Nacht** – oder auf **Phasen ansehen** in der Schlafkarte – öffnet den Verlauf. Oben vier Zeiträume (**Nacht, Woche, Monat, 6 M**), darunter die Auswahl zwischen Schlaf, HRV, Puls, Atmung und Sauerstoff.

- **Nacht, Schlaf:** die Phasen als Spuren wie in der Health-App, Wach oben bis Tief unten, mit den Farben Rot, Türkis, Blau und Indigo. Darunter Dauer und Anteil je Phase.
- **Nacht, Messwert:** der Verlauf aus den Einzelmessungen, mit deinem Schnitt als gestrichelter Linie und dem üblichen Bereich grau hinterlegt.
- **Woche bis 6 Monate:** je Nacht eine Säule – beim Schlaf nach Phasen gestapelt, sonst ein Punkt je Nacht mit der Mittellinie. Ein Tipp auf eine Säule springt in diese Nacht.

Wie viele Messwerte dabei zusammenkommen, hängt vom Band ab: Puls, Atmung und Sauerstoff liefern pro Nacht Dutzende bis Hunderte Werte, HRV oft nur zwei bis fünf.

## Trainings

Die Karte **Letzte Trainings** auf „Heute“ zeigt die letzten zwölf Einheiten – gemessene und selbst eingetragene zusammen, damit ein bestätigter Sport nicht aus dem Blick gerät. Je Zeile Art, Tag, Uhrzeit, Dauer und, wo vorhanden, **Strecke und Tempo** (min/km, beim Radfahren km/h), Ø-Puls und Energie. Oben rechts die Summe der letzten sieben Tage. Ein Tipp öffnet die Zusammenfassung mit Pulszonen.

**Kilometer** liest die App aus dem Apple-Health-Export (`totalDistance` und die Statistiken je Einheit) und aus Strava. Der Helio Strap selbst liefert über Zepp keine Strecke – dort bleibt die Angabe leer.

### Strava

Eine direkte Verbindung zu Strava ist für diese App nicht möglich: Strava verlangt dafür einen Server mit geheimem Schlüssel, und Formkurve ist eine reine Seite auf GitHub Pages. Zwei Wege gibt es trotzdem:

| Weg | So geht es |
| --- | --- |
| **Über Apple Health** (einfacher) | In der Strava-App „Gesundheit“ einschalten. Strava schreibt die Trainings dann nach Health, und sie kommen mit dem normalen Export oder Kurzbefehl mit. |
| **Export-Datei** | Strava → Einstellungen → Mein Konto → „Eine Kopie deiner Daten herunterladen“. Im ZIP liegt `activities.csv`; entpacken und unter **Daten importieren → Datei wählen** auswählen. Daraus werden Trainings mit Art, Dauer, Strecke, Puls und Energie – auch rückwirkend über Jahre. |

Die Art wird übersetzt (Run → Laufen, Ride → Radfahren, WeightTraining → Kraft und so weiter), Unbekanntes landet bei „Anderes“.

## Prüfung an echten Daten

Im Ordner `test/fixtures/echte-naechte.json` liegen zehn echte Nächte mit dem Helio Strap, anonymisiert: Datum um 364 Tage zurückgeschoben (Wochentage bleiben gleich), kein Tagebuchtext, Puls der neun älteren Tage auf ein 10-Minuten-Raster ausgedünnt. `test/echtedaten.test.mjs` hält damit fest, was an diesen Tagen herauskommen muss — unter anderem, dass die Nacht nach sieben Getränken eine Tagesform unter 25 ergibt und nicht wie früher um die 40.

Diese Testdaten haben zwei Fehler aufgedeckt, die mit erfundenen Daten unsichtbar blieben:

- **Alkohol auf der falschen Nacht.** Der Abendcheck wird am Abend ausgefüllt, also nach der Nacht, die der Tag misst. Die Tagesform zog den Alkohol deshalb vom falschen Tag ab — und ein „nein“ am Folgetag verdeckte das „ja“ vom Vortag ganz. Jetzt gilt für die Nacht von Tag d der Abendcheck von d−1.
- **Eine Einheit als zwei gezählt.** Eine Trainingspause von zehn Minuten teilte den Abschnitt in zwei Nachfragen.

## Was wo im Code steht

| Datei | Inhalt |
| --- | --- |
| `js/version.js` | Versionsnummer (muss zu `sw.js` passen; ein Test prüft das) |
| `js/journal/journal.js` | Logbuch: Einträge, Tageswerte, Zusammenführen zweier Geräte, Antworten für Abendcheck und Einsichten |
| `js/ui/journalView.js` | Logbuch-Ansicht, Rückblick und Karte auf „Heute“ |
| `js/ui/app.js`, `js/ui/state.js` | Reiter, Adressen wie `#profil/konto`, Weiterleitung alter Adressen |
| `js/ui/profileView.js`, `js/ui/dataView.js` | Reiter „Profil“: Übersicht und Unterseiten (Konto, Import, Körperdaten, Umwelt, Einstellungen, Backup) |
| `js/ui/checkin.js` | Check-in als Blatt, der schwebende Knopf und die Zählung offener Checks |
| `js/model/calendar.js`, `js/ui/calendarView.js` | Monatsraster, Farbstufen und der Kalender auf „Heute“ |
| `js/sync/` | Online-Konten: Firebase über REST, Verschlüsselung der Einträge, Abgleich und Zusammenführen |
| `js/model/periods.js` | Tagesform je Woche und Monat |
| `js/data/db.js`, `js/data/repo.js` | Datenbank mit ihren Bereichen, Formatnummer und Umwandlungen bei Updates |
| `js/auth/` | Konten, PIN, Wiederherstellung, Verschlüsselung |
| `js/survey/catalog.js` | Fragenkatalog mit Kern- und optionalen Fragen, Rangfolge, Folgefragen |
| `js/survey/supplements.js` | Supplement-Katalog, eigene Mittel, Zuordnung alter Antworten |
| `js/survey/engine.js` | welche Fragen wann erscheinen, Vorbelegung |
| `js/analysis/insights.js` | Einflussfaktoren (auch je Supplement), Permutationstest, Benjamini-Hochberg, Ridge |
| `js/model/hints.js` | Hinweise des Tages und die Begründung, wenn die Tagesform fehlt |
| `js/model/earlywarning.js` | Frühwarnungen: Auslöser, Störfaktoren, Pausen |
| `js/model/sports.js` | Katalog der Sportarten mit Startwerten für die Erkennung |
| `js/model/detect.js` | Abschnitte mit erhöhtem Puls finden, Art schätzen, aus Einträgen lernen |
| `js/ui/nightView.js` | Nacht im Detail: Schlafphasen, Verlauf je Messwert, Woche bis 6 Monate |
| `js/import/strava.js` | activities.csv aus dem Strava-Export lesen |
| `js/ui/workouts.js` | Karte „War das Sport?“, Sportauswahl und die Zusammenfassung einer Einheit |
| `js/model/lifestyle.js` | Logbuch-Zuschlag auf die Tagesform und die Erklärungen für auffällige Nachtwerte |
| `js/ui/cards.js` | Karten auf „Heute“: Katalog, Sichtbarkeit, Vorschlag zum Ausblenden |
| `js/model/coverage.js` | Datenprüfung: Zustand je Messwert, welche Berechnung woran hängt, Text der Meldung |
| `js/data/normalize.js` | Typnamen, Einheiten, Messbereiche; sagt auch, warum ein Wert verworfen wurde |
| `js/norms/references.js` | Normal- und Richtwerte mit Quellen für alle Infopunkte |
| `js/context/` | Standort, Wetter, Feinstaub und Pollen von Open-Meteo |
| `js/model/` | Formeln für Baseline, Recovery, Schlaf, Strain, Balance, Fitness, Tagesform |
| `css/app.css` | Farbtoken je Variante (`[data-palette="rot"]`), Hell und Dunkel |
| `design/` | zweite Design-Variante im Stil von Apple Health, eigene Zählung in `design/version.js` |
| `js/ui/` | Oberfläche (Preact mit htm, ohne Build-Schritt) |
| `sw.js` | Offline-Zwischenspeicher je Version |

## Entwickeln

```sh
npm install        # nur für Tests und Build-Werkzeuge
npm test           # Tests für Formeln, Importe, Einflussanalyse, Konten, Check-in, Logbuch, Updates und Abgleich
npm run serve      # lokaler Server auf http://localhost:8080
npm run build      # dist/formkurve-vorschau.html und dist/formkurve-<version>.zip
```

Für eine neue Version die Nummer in `js/version.js` und `sw.js` erhöhen. Neue Fragen bekommen eine neue Kennung; bestehende Kennungen und Antwortwerte nie umbenennen. Ändert sich das Datenformat, `DATA_FORMAT` in `js/data/repo.js` erhöhen und eine Umwandlung in `MIGRATIONS` ergänzen. Ein neuer Speicherbereich kommt in `STORES` in `js/data/db.js`, dazu `DB_VERSION` erhöhen; Bereiche werden nur ergänzt, nie gelöscht.

## Grenzen

- Die Scores sind eine eigene Heuristik, keine medizinische Bewertung. Bei Beschwerden zählt ärztlicher Rat.
- Welche Werte Zepp an Apple Health liefert, hängt von der Zepp-Version ab.
- Ohne Online-Konto gilt ein Konto nur auf dem Gerät, auf dem es angelegt wurde. Ohne PIN und ohne Wiederherstellungscode sind die Daten verloren; beim Online-Konto ist der Code zusätzlich der Schlüssel für jedes neue Gerät.
- Ein Konto, das schon auf einem Gerät liegt, lässt sich nicht nachträglich mit einem bestehenden Online-Konto zusammenlegen. Für das zweite Gerät deshalb immer „Mit Online-Konto anmelden“ wählen.
- Die verschlüsselten Daten liegen bei Google (Firebase); E-Mail-Adresse und Zeitpunkte des Abgleichs sind dort lesbar, der Inhalt nicht.
- Open-Meteo liefert Wetter nur 92 Tage rückwirkend.
- Schreibst du auf zwei Geräten gleichzeitig am Tagebuch desselben Tages, gilt der zuletzt gespeicherte Text.

Lizenzen: Preact und htm (MIT), fflate (MIT). Wetter: Open-Meteo.com (CC BY 4.0); Luftqualität und Pollen: Copernicus Atmosphere Monitoring Service über Open-Meteo.
