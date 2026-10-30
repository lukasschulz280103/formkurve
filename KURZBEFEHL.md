# Kurzbefehl „Formkurve Sync“

Der Kurzbefehl liest die Werte der letzten zwei Tage aus Apple Health und kopiert sie als Text in die Zwischenablage. Formkurve liest diesen Text ein. Doppelte Werte schaden nicht, die App erkennt sie.

## Einrichten (einmalig, etwa 10 Minuten)

1. App **Kurzbefehle** öffnen, **+** tippen, Namen **Formkurve Sync** vergeben.
2. „Aktion hinzufügen“ → nach **Health** suchen → die Aktion zum Suchen von Health-Daten wählen (englisch „Find Health Samples“, auf Deutsch je nach iOS-Version leicht anders benannt).
   - Filter: **Typ ist Herzfrequenz**
   - Filter: **Startdatum ist in den letzten 2 Tagen**
   - Sortieren nach **Startdatum**, keine Begrenzung
3. Aktion **Zu Variable hinzufügen** anfügen, Variablenname `Proben`.
4. Schritt 2 und 3 wiederholen für:
   - Herzfrequenzvariabilität
   - Ruheherzfrequenz
   - Atemfrequenz
   - Blutsauerstoff
   - Schritte
   - Schlafanalyse
5. Aktion **Wiederholen mit jedem Objekt** anfügen, Eingabe: Variable `Proben`.
6. In die Wiederholung eine **Text**-Aktion legen. Darin sechs Eigenschaften der Variable **Wiederholungsobjekt** einsetzen, getrennt durch Semikolon:

   ```
   Typ;Startdatum;Enddatum;Wert;Einheit;Quelle
   ```

   Eigenschaft wählen: auf die eingesetzte Variable tippen und die Eigenschaft aussuchen. Bei Start- und Enddatum als Datumsformat **ISO 8601** wählen, wenn es angeboten wird.
7. Nach „Ende der Wiederholung“: **Text kombinieren** mit den Wiederholungsergebnissen, Trennzeichen **Neue Zeilen**.
8. **In Zwischenablage kopieren**.
9. Optional: **Mitteilung anzeigen** mit dem Text „Daten kopiert, jetzt Formkurve öffnen“.
10. Einmal ausführen und den Zugriff auf alle Health-Typen erlauben.

Eine Zeile sieht dann so aus:

```
Herzfrequenz;2026-10-26T03:12:00+01:00;2026-10-26T03:12:00+01:00;54;count/min;Zepp
```

Auch deutsche Datumsangaben (`26.10.2026, 03:12`), Kommazahlen (`0,97`) und deutsche Schlafphasen (`Kern`, `Tief`, `REM`, `Wach`, `Im Bett`) werden erkannt.

## Täglich nutzen

1. Kurzbefehl ausführen (Home-Bildschirm, Widget oder Siri: „Formkurve Sync“).
2. Formkurve öffnen → auf **Heute** im Hinweis **Einfügen und importieren** tippen. Der Hinweis erscheint, solange die letzte Nacht fehlt oder die Daten älter als 20 Stunden sind; sonst **Profil** → **Daten importieren** → **Einfügen und importieren**. Lässt iOS die Zwischenablage nicht direkt lesen, dort lange in das Textfeld tippen → **Einsetzen** → **Text importieren**.

Automation als Tipp: In Kurzbefehle → Automation → „Wecker wird gestoppt“ → Kurzbefehl „Formkurve Sync“ ausführen. Health-Daten sind nur lesbar, wenn das iPhone entsperrt ist.

## Wenn es hakt

| Problem | Lösung |
| --- | --- |
| „Keine verwertbaren Zeilen“ | Prüfe, ob die Text-Aktion wirklich die Eigenschaften einsetzt und nicht nur „Wiederholungsobjekt“ |
| Typ „nicht erkannt“ | Der Typname erscheint in der Import-Zusammenfassung; melde ihn, dann wird er ergänzt |
| Kurzbefehl läuft lange | Zeitraum auf „letzten 1 Tag“ verkürzen und täglich ausführen; für die Historie den Health-Export nehmen |
| HRV landet einen Tag zu früh | In Formkurve unter Profil → Daten importieren den HRV-Tagesversatz auf „+1 Tag“ stellen |
| Schritte doppelt (iPhone und Strap) | Unter Profil → Daten importieren → Quellen „Zepp“ nach oben schieben |
