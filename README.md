# Kleine Dinge

Eine PWA für persönliche Aufgaben und Gedanken. Das Projekt braucht weder Build-Schritt noch Backend oder externe Bibliotheken.

## Vorschau und PWA

- **Interaktive Vorschau** — Die separate HTML-Datei im Browser öffnen. Vorschau und installierte App speichern getrennt.
- **PWA lokal prüfen** — In diesem Ordner `python3 -m http.server 8000` ausführen und anschließend `http://localhost:8000/` öffnen. Nach dem ersten vollständigen Laden und der Aktivierung des Service Workers lässt sich die App auch offline neu laden. Lokal geöffnete HTML-Dateien unterstützen keine PWA-Installation.
- **iPhone 13 Pro** — Die veröffentlichte HTTPS-Adresse in Safari öffnen, im Teilen-Menü „Zum Home-Bildschirm“ wählen und, sofern angezeigt, „Als Web-App öffnen“ aktivieren. Die App nutzt Safe Areas um Notch und Home-Indikator, 44-Punkt-Tippflächen und 16-Pixel-Eingaben. Offline nach der Installation einmal öffnen, dann im Flugmodus erneut aufrufen.

## Bedienung

- **Heute und Irgendwann** — Direkt im Feld unter der Liste schreiben. Eine ausgefüllte Aufgabe wird mit Enter, über Plus oder beim Verlassen des Eingabefelds angelegt. Ein passendes Emoji wird aus dem Text vorgeschlagen, sonst erscheint dein Standard-Emoji (anfangs 🪴). Unter „Deine App“ kannst du es ändern. Tippen auf die Emoji-Kachel öffnet die Auswahl. Im Picker findest du elf kuratierte Kategorien. „Alle“ zeigt den vollständigen Unicode-Emoji-Katalog. Die Suche durchsucht unabhängig vom ausgewählten Reiter deutsche Emoji-Namen und Stichwörter, darunter Flaggen und Hauttöne. Weitere Emojis kannst du direkt in das Suchfeld einfügen. Halte ein Emoji gedrückt, um verfügbare Hauttöne auszuwählen. Mit der Tastatur öffnet die Pfeil-nach-oben-Taste die Hauttöne für das fokussierte Emoji. Bereits gewählte Emojis bleiben beim Bearbeiten erhalten.
- **Text und Unteraufgaben** — An die gewünschte Textstelle tippen und dort losschreiben. Nur in der fokussierten Aufgabe erscheint das Feld für Unteraufgaben. Ein Tipp auf die freie Kartenfläche oder Enter im vorhandenen Aufgabentext bringt den Cursor dorthin. Backspace im leeren Eingabefeld springt zur vorigen Zeile. Weiteres Backspace löscht ihren Text Zeichen für Zeichen. Vollständig geleerte Aufgaben ohne Unteraufgaben werden beim nächsten Backspace entfernt.
- **Abhaken und Tageswechsel** — Erledigte Einträge behalten ihre Position. Offene Heute-Aufgaben werden am nächsten lokalen Kalendertag weitergeführt. Wie in V1 bleiben erledigte Karten auch danach sichtbar. Es gibt kein Tagesarchiv.
- **Kartenaktionen** — Links wischen legt Duplizieren und Löschen frei. Bei Aufgaben verschiebt die rechte Geste zwischen Heute und Irgendwann, mitsamt Unteraufgaben. Bei Kategorien öffnet sie „Kategorie bearbeiten“. Für eine Alternative gedrückt halten und loslassen oder Rechtsklick bzw. Umschalt+F10 verwenden. Im Kontextmenü lassen sich Karten auch nach oben und unten verschieben.
- **Sortieren** — Eine Karte oder Unteraufgabe gedrückt halten, dann innerhalb ihrer Liste an die gewünschte Position ziehen. Beim Loslassen bestimmt die obere oder untere Hälfte der Zielkarte die Einfügeposition.
- **Mein Raum** — Kategorien bestehen aus Emoji und Titel. Jeder Gedanke hat ein einziges frei editierbares Textfeld. Im bestehenden Gedanken erzeugt Enter einen Umbruch. Im Eingabefeld fügt Enter einen neuen Gedanken hinzu. Mit Umschalt+Enter oder Einfügen mehrzeiliger Texte kann der neue Gedanke direkt mehrere Zeilen enthalten.

## Speicher und Backups

Aufgaben und Gedanken werden in IndexedDB und, soweit verfügbar, zusätzlich in localStorage auf demselben Browser bzw. derselben Installation gespeichert. Daten aus V1 werden bei gleicher Website-Adresse automatisch übernommen. Im Einstellungsmenü können JSON-Backups der Versionen 1 und 2 importiert werden. Ein Import ersetzt den aktuellen Datenstand nach Rückfrage. Für eine andere Website-Adresse oder einen Gerätewechsel vorher exportieren und dort importieren. Beim Löschen von Websitedaten kann der lokale Datenstand verloren gehen.

## Kostenlos auf GitHub Pages veröffentlichen

1. Ein öffentliches Repository anlegen, zum Beispiel `kleine-dinge`.
2. Alle Dateien aus diesem ZIP ins Repository-Stammverzeichnis laden, inklusive `.nojekyll`. Bei einer Veröffentlichung über das GitHub-Webinterface kannst du diese leere Datei auch über „Create new file“ anlegen.
3. In **Settings → Pages → Build and deployment → Source** die Option **Deploy from a branch** wählen. Branch **main** und Ordner **/(root)** auswählen und speichern.
4. Sobald GitHub die Adresse anzeigt, `https://BENUTZERNAME.github.io/kleine-dinge/` in Safari öffnen.

Der Quellcode liegt öffentlich auf GitHub. Aufgaben, Gedanken und Backups werden von der App nie an GitHub übertragen. Alle Verweise sind relativ, damit die PWA in einem Repository-Unterpfad und an einer eigenen Domain läuft. Bei Änderungen an Dateien im Offline-Cache die Versionskennung in `service-worker.js` erhöhen. Eine neue Version wird aktiv, sobald die bisherige App-Instanz geschlossen und erneut geöffnet wurde.

[GitHub Pages – Veröffentlichungsquelle einstellen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

[Apple – Websites als App zum Home-Bildschirm hinzufügen](https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios)

Die Gruppierung des Offline-Emoji-Katalogs basiert auf [Unicode Emoji 17.0](https://unicode.org/Public/17.0.0/emoji/emoji-test.txt). Die deutschen Suchbegriffe stammen aus den [CLDR-48-Annotationen](https://github.com/unicode-org/cldr/tree/release-48/common/annotations) und den [abgeleiteten Annotationen](https://github.com/unicode-org/cldr/tree/release-48/common/annotationsDerived). Die Lizenz liegt in `LICENSE-unicode.txt`.
