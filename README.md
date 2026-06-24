# Menu Letters Content Studio

Eine cleane Social-Media-Content-Planungsplattform für **Menu Letters**, deinen Snail Mail Club.

## Enthaltene Funktionen

- Dashboard mit offenen To-dos, Content-Ideen und Monatslogik
- Spezialisierter Menu-Letters-AI-Assistent
  - Content-Ideen
  - Hooks
  - Szenenliste
  - Voice-over
  - Caption
  - Hashtags
  - To-do-Übernahme
- Funktionierende To-do-Liste
  - abhaken
  - bearbeiten
  - löschen
  - Prioritäten
- Voll funktionsfähiger Content-Kalender mit deutscher Dropdown-Datumsauswahl, Monats-/Jahreswechsel, Tagesagenda sowie Bearbeiten/Löschen von Einträgen
  - Einträge hinzufügen
  - Einträge bearbeiten
  - Einträge löschen
  - Monatsnavigation
- Jahresübersicht
  - 12 Monatskarten
  - Titelbild pro Monat
  - Klick öffnet Moodboard
- Journal-Moodboard
  - linke Seite: handschriftliche Notizen
  - rechte Seite: Fotos hinzufügen
  - Fotos verschieben
  - Fotos größer/kleiner machen
  - Fotos drehen
  - Fotos löschen
  - Washi-Tape-Details
  - silberne 3D-Herz-Magnete
- Supabase-Integration
  - Auth
  - Datenbank
  - privater Storage Bucket für Moodboard-Fotos
- Private Login-Startseite
  - Dashboard und Plattform sind standardmäßig versteckt
  - Zugriff erst nach erfolgreichem Supabase-Login
- Optional: Supabase Edge Function für echten OpenAI/GPT Assistant

## Projekt starten

Am einfachsten mit VS Code:

1. Ordner öffnen: `menu-letters-content-planner`
2. Extension **Live Server** installieren
3. Rechtsklick auf `index.html`
4. **Open with Live Server** auswählen

Wichtig: Bitte nicht direkt als `file:///.../index.html` öffnen. Nutze Live Server, damit Supabase/Auth sauber funktioniert.

## Supabase einrichten

1. In Supabase ein neues Projekt öffnen
2. Links zu **SQL Editor** gehen
3. Inhalt aus `supabase/schema.sql` einfügen und ausführen
4. Prüfen, ob der private Bucket `menu-letters-moodboards` angelegt wurde
5. Unter **Authentication → Providers** E-Mail/Passwort aktivieren
6. Unter **Project Settings → API** folgende Werte kopieren:
   - Project URL
   - anon public key
7. Beim Öffnen der App erscheint zuerst die private Login-Seite
8. Dort **Supabase Verbindung einrichten** öffnen
9. Project URL und anon public key einfügen
10. Auf **Speichern & verbinden** klicken
11. Account erstellen oder einloggen
12. Nach erfolgreichem Login erscheint die Plattform

## GPT Assistant aktivieren

Der echte GPT Assistant läuft über eine Supabase Edge Function. Dadurch bleibt dein OpenAI API Key sicher und wird nicht im Browser sichtbar.

### Supabase CLI Setup

```bash
supabase login
supabase link --project-ref DEIN_PROJECT_REF
supabase functions deploy menu-assistant
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
```

Danach nutzt die App automatisch die Edge Function. Wenn sie nicht erreichbar ist, nutzt sie nach dem Login den eingebauten Menu-Letters-Generator.

## Dateistruktur

```txt
menu-letters-content-planner/
├── index.html
├── styles.css
├── app.js
├── README.md
└── supabase/
    ├── schema.sql
    └── functions/
        └── menu-assistant/
            └── index.ts
```

## Designrichtung

- Hauptfarbe: Weiß / warmes Papierweiß
- Typografie: moderne UI-Schrift + Editorial Serif + leserliche Handschrift
- Look: clean, elegant, hochwertig, editorial, leicht romantisch
- Moodboard: aufgeklapptes Journal mit Notizen, Fotos, Washi Tape und 3D-Magneten

## Wichtiger Hinweis

Der OpenAI API Key gehört niemals in `app.js` oder irgendeine Frontend-Datei. Nutze dafür immer die Supabase Edge Function.


## Private Nutzung

Die Plattform ist jetzt als private App aufgebaut. Beim Öffnen erscheint immer zuerst die Login-Seite. Sidebar, Dashboard, To-dos, Kalender, Jahresübersicht, Moodboards und Settings sind ohne Login nicht sichtbar.

Nachdem du deinen eigenen Account erstellt hast, kannst du in Supabase unter **Authentication → Signups** neue Registrierungen deaktivieren. So bleibt die Plattform nur für dich nutzbar.


## Private Login-Version

In dieser Version werden Supabase URL und Anon/Public Key nicht mehr auf der Login-Seite angezeigt.

1. Öffne `config.js`.
2. Trage dort deine Supabase Project URL und deinen anon/public/publishable Key ein:

```js
window.MENU_LETTERS_SUPABASE_CONFIG = {
  url: 'https://deinprojekt.supabase.co',
  anonKey: 'dein-anon-public-key'
};
```

Wichtig: Niemals den `service_role` Key eintragen. Der gehört nicht in Browser-Code.

Danach erscheint beim Öffnen der Website nur noch die private Login-Seite. Die Plattform wird erst sichtbar, wenn du erfolgreich eingeloggt bist.

Für eine persönliche Plattform empfehle ich:

- Deinen Account in Supabase unter Authentication → Users erstellen.
- Danach neue Registrierungen in Supabase deaktivieren.
- Den Storage Bucket `menu-letters-moodboards` privat lassen.
- Row Level Security aus `supabase/schema.sql` aktiviert lassen.

## Kalender Update

Der Kalender nutzt jetzt keine Browser-Datepicker mehr für Kalendereinträge, sondern deutsche Dropdowns:

- Tag, Monat und Jahr werden separat ausgewählt
- Monate erscheinen auf Deutsch, z. B. `06 · Juni`
- Termine werden als `24.06.2026` bzw. ausgeschrieben als `Mittwoch, 24. Juni 2026` angezeigt
- Ein Klick auf einen Tag öffnet die Tagesplanung
- Ein Klick auf einen Kalendereintrag öffnet den Bearbeitungsdialog
- Einträge können bearbeitet, gelöscht und mit Notizen ergänzt werden
- To-dos mit Datum erscheinen ebenfalls im Kalender

