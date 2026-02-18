# social_order_v0.19.3.1 (Demo)
Dieses Paket ist ein klickbarer HTML/JS-Prototyp: ein Social-Intranet-Rahmen („GovConnect“) plus eingebettete App „Social Order“ für Bürobedarfs-Anforderungen.

## Start
- Öffne `index.html` über deinen lokalen Testserver (z. B. VS Code Live Server).
- Es werden **keine** externen Libraries geladen.
- Daten sind Mock-Daten; Änderungen werden in `localStorage` gespeichert.

> Tipp: Wenn dir „komische Zustände“ auffallen, nutze **Info → Demo zurücksetzen** oder lösche den localStorage-Eintrag im Browser.

## Was ist neu in v0.19.3.1

- Organisation: Verwaltungsspitze (Oberbürgermeisterin) ist als oberster Knoten sichtbar.
- Organisation: Startansicht ist kompakt (Fachbereiche sichtbar, Ämter erst nach Klick auf Fachbereich).

- **Person-Modal: Kontakt-Aktionen als Icons (Chat, Anruf, Video, E‑Mail)**
  - Buttons sind in der Demo nur Darstellung; im Modal erscheint ein Hinweis.
- **Doppelrollen sichtbar**
  - Amtsleitungen, die zugleich Fachbereichsleitung sind (Amt 11/21/31/41), zeigen beide Rollen als Pills.

## (Historie) Was ist neu in v0.19.2

- **Personen als eigenes App‑Modul + People‑Model**
  - Personen‑Screen ist jetzt ein eigenes Modul (`apps/peo_people.js`).
  - Neues People‑Domain‑Modell (`domain/people.js`) für Verzeichnisdaten (Kontakt‑Mock, Org‑Ableitung).
  - Klick auf eine Person öffnet ein Detail‑Modal (Kontaktfelder als Mock).

- **Dokumente: weitere Projekte**
  - Zusätzlich zu Social Order gibt es jetzt Projekte **Dokumente** und **Personen** mit je einer Projekt‑PDF.

## (Historie) Was ist neu in v0.19.1

- **Dokumente projektfähig + PDF‑Vorschau**
  - Dokumente sind jetzt nach Projekten strukturiert (z. B. **Social Order**).
  - PDF‑Vorschau direkt in der Dokumente‑Ansicht, Doppelklick öffnet die Datei im Modal.
  - Statische Demo‑PDFs liegen unter `assets/docs/projects/social-order/`.

- **Router unterstützt Query‑Parameter (Hash)**
  - Routen wie `#/dokumente?project=social_order&doc=rv1_officepro` funktionieren, ohne dass die Navigation bricht.

## (Historie) Was ist neu in v0.19.0

- **Head-Navigation umgestellt**
  - Reihenfolge jetzt: **Startseite · Kalender · Organisation · Personen · Dokumente · Apps**
  - **Chronik** ist nicht mehr in der Kopfzeile, der Zugriff läuft über das **Glocken-Symbol** (Activity) und die Route bleibt erreichbar.
  - **Bereiche** heißt jetzt im UI **Organisation** (Label und Screen-Überschrift).

- **Verträge bleiben Single Source of Truth**
  - Rahmenverträge inkl. Artikellisten liegen weiterhin unter `assets/js/domain/contracts/*`.
  - `MOCK.suppliers` und `MOCK.catalog` werden daraus abgeleitet, keine doppelte Pflege.

## (Historie) Was ist neu in v0.18.9.1

- **Sonderbedarf-Begründung ist wieder Pflicht**
  - Wenn mindestens ein Artikel im Warenkorb als **Sonderbedarf** markiert ist, blockt der Submit ohne Begründung.
  - Ursache war, dass das Sonderbedarf-Signal nicht in die Gate-Engine weitergegeben wurde.

## (Historie) Was ist neu in v0.18.6.2

- **Vertragsdaten als Single Source of Truth vorbereitet**
  - Neue Struktur unter `assets/js/domain/contracts/*` hält Rahmenverträge **inklusive Artikellisten**.
  - `assets/js/contracts.js` re-exportiert daraus die bisherigen Textbausteine (UI bleibt kompatibel).
  - `MOCK.suppliers` und `MOCK.catalog` werden jetzt aus den Vertragsdaten abgeleitet, statt doppelt gepflegt.

- **Store-Fallback erweitert**
  - `localStorage`-Fallback berücksichtigt jetzt auch v0.18.5.

## Hinweise

Die in v0.18.3 eingeführten Umbenennungen (`so_batch.js`, `so_dashboard.js`) bleiben bestehen.
  - Dashboard-View (`mountDashboard`) liegt jetzt in `assets/js/apps/dashboard.js`.
  - `app.js` ruft Dashboard über eine injizierte Context-Schnittstelle auf (keine Funktionsänderung).
  - Hinweis: Der Bestelllauf war bereits in v0.18.0 nach `assets/js/apps/batch.js` ausgelagert.
  - Ziel: app.js weiter verkleinern und die großen Domänenblöcke isolieren.

## Was ist neu in v0.15.6
- **Personen (Shell) erweitert**:
  - Mehr Personen (Mock-Verzeichnis, ~50+) statt nur 6 Karten.
  - **Umblättern/Pagination** (10 pro Seite).
  - **Filter nach Amt/Einheit** (inkl. Zentrale Beschaffung & IT‑Service).
  - Pro Person **Chat / Anruf / Video**‑Buttons (nur Darstellung, öffnet Demo‑Hinweis).

## Was ist neu in v0.15
- **Analyse-Drilldown**: In **Dashboard → Analyse** können die Balken angeklickt werden.
  - Klick auf einen Balken öffnet ein Detail-Modal mit **Top POs** im aktuell gesetzten Zeitraum/Filter.
  - Klick auf eine PO-Zeile öffnet die **Anforderungs-Detailansicht**.

## Was ist neu in v0.15.1
- KPI-Logik im **Dashboard → Lagebild** geglättet:
  - **„Anforderungen“** zählt nun Anforderungen, die im Zeitraum eine Bestellung (PO) erzeugt haben.
  - **„Ø Anforderungen je PO“** als verständliche Bündelungs-Kennzahl.
  - **„Split-Quote“** (Multi-Lieferant): Anteil der Anforderungen, die in mehrere POs aufgeteilt werden.

## Was ist neu in v0.15.2
- **Drilldown-Modal poliert** (Dashboard → Analyse):
  - KPI-Label präzisiert (**„Anteil am Gesamtwert (im Zeitraum)“**).
  - Tabelle ist im Modal ohne horizontales Scrollen nutzbar (kompakteres Layout).

## Was ist neu in v0.15.3
- **Filter-UX finalisiert** (Dashboard):
  - Filterstatus ist im Dashboard überall sichtbar (hilft bei Screenshots).
  - „7/30/90 Tage“-Preset schreibt die zugehörigen Von/Bis-Daten mit (Preset → Custom ist nicht überraschend).
  - **Enter** in den Datumsfeldern triggert **Anwenden**.
  - „Filter ändern“ (Analyse) springt mit Fokus + kurzem Highlight zur Filterleiste.

## Was ist neu in v0.14
- **Dashboard: Tab „Analyse“**: zwei ruhige Vergleichs-Ansichten
  - **Top Ämter** (PO-Teile) nach **Bestellwert** oder **Anzahl POs**.
  - **Top Kostenstellen** nach **Bestellwert** oder **Anzahl POs**.
  - Optional: „Sonstige“-Aggregation, damit es nicht unruhig wird.

## Was ist neu in v0.13.2 / v0.13.1
- **Repair/Migration für Orga-Filter**: Wenn ältere Demo-Daten (localStorage) Organisationslabels enthalten, die nicht zur aktuellen Exempla-Orga passen, wird automatisch repariert bzw. die Historie neu geseedet – damit **Fachbereich/Amt-Filter** im Dashboard zuverlässig funktionieren.

## Was ist neu in v0.13
- **Dashboard (Leitung) entschlackt**: Tabs heißen jetzt **Steuerung** (Backlog/Status) und **Lagebild** (Volumen/Mix/Trend).
- **Filter nach Fachbereich/Amt** (Demo-Stammdaten): KPIs & Visuals im Dashboard reagieren auf die Auswahl.
- **Mix-Umschaltung** im Donut: Dimension **Lieferant ↔ Rahmenvertrag** und Kennzahl **Bestellwert ↔ Anzahl POs**.
- **Trend als Balkenchart** (Tage/Wochen/Monate je nach Zeitraum) – stabiler fürs Responsive-Layout.

## Was war neu in v0.12
- **Stammdaten „Kreisstadt Exempla“**: realistische Organisationseinheiten (Fachbereiche/Ämter) für eine Kreisstadt.
- **Organisationseinheit als Dropdown** (Demo): Im Livebetrieb käme sie aus dem Current User/Profil.
- **Kostenstellen mit Klarname**: Auswahl als Dropdown im Format „Code · Klarname“.
- **Verwendungszweck / Bestellgrund**: optionales Freitextfeld in der Anforderung (für Nachvollziehbarkeit).

## Was war neu in v0.11
- **Detail-Modal scrollbar**: lange Bestelldetails (inkl. Audit-Trail) sind vollständig sichtbar.
- **PDF/Drucken** in der Detailansicht: Button „PDF“ (Browser-Druckdialog → „Als PDF speichern“).
- **Bestelllauf-Ansicht klarer**: Wenn aktuell keine freigegebenen Anforderungen vorliegen, wird der **letzte Bestelllauf** im Eingang erklärt (damit rechts angezeigte Ergebnisse nicht „widersprüchlich“ wirken).

## Bereits drin (aus v0.10)
- **Historische Bestelldaten (12 Monate)** für die **Dashboard-Periodenansicht** (KPI & Visuals sind sofort befüllt).
  - Diese Historie ist **nicht** in „Meine Anforderungen“ sichtbar, damit der operative Flow übersichtlich bleibt.
  - **Manuell auslösen & verarbeiten** bleibt unverändert (Bestelllauf → Bestellung auslösen), und neue POs wirken zusätzlich auf die KPIs.
- **Multi-Lieferanten-Warenkorb**: Mitarbeitende dürfen Artikel aus mehreren Lieferanten in *eine* Anforderung legen.
- **Automatische Aufsplittung im Bestelllauf**: Zentrale Beschaffung bündelt und splittet automatisch **pro Lieferant** (Teilbestellungen).
- **Teilstatus**: Eine Anforderung kann *teilweise bestellt/abgeschlossen* sein, wenn Lieferanten unterschiedlich weit sind.
- Katalog: Warengruppen + globale Artikelsuche in „Neue Anforderung“.
- Sonderbedarf: bestimmte Artikel (z.B. Whiteboard Wandmontage) erzwingen eine Begründung.
- Theme: **Hell/Dunkel** per Toggle oben rechts.
- Rückfrage-Workflow: Freigabe kann eine Rückfrage mit Kommentar stellen (Status „Rückfrage“), Mitarbeitende kann antworten.
- Mini-Chronik/Aktivität: Benachrichtigungen über Glocke (oben rechts) und im Menüpunkt „Chronik“.
- **Dashboard (Leitung)**: Steuerung/Lagebild (KPI-Kacheln + Donut + Trend als Balken).

## Rollen (oben rechts)
- Mitarbeitende: Neue Anforderung, Meine Anforderungen
- Freigabe: zusätzlich Freigaben
- Zentrale Beschaffung: zusätzlich Bestelllauf
- Leitung: zusätzlich Dashboard (Steuerung/Lagebild inkl. Visuals)

## Demo-Gate (aktuell)
- Schwelle **25 €** (Summe über alle Positionen)
- plus Freigabe bei Sonderbedarf (inkl. automatisch markierter Artikel) oder Dringlichkeit „Dringend“

## Versionierung
- Jede Änderung wird als neues ZIP geliefert und die Versionsnummer erhöht (v0.2, v0.3, …, v0.15.0).