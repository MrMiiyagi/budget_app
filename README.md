# Budget App

Eine kleine Budget-App (React + TypeScript + Vite) mit **Geräte‑Sync über Supabase** und **Deployment über GitHub Pages**.

## Lokal starten

```bash
npm install
npm run dev
```

Dann öffnen: `http://localhost:5173/`

### GitHub Pages

GitHub Pages hat kein SPA-Rewrite. Deshalb nutzt die App **Hash-Routing**:
- Login ist dann `/#/login`
- App ist `/#/`

Es ist ein Workflow vorbereitet: `.github/workflows/deploy-pages.yml`

**Einmalig einrichten:**
- In GitHub Repo: **Settings** → **Pages**
  - **Build and deployment**: *GitHub Actions*
- In GitHub Repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Dann nach einem Push auf `main` wird automatisch deployed nach:
`https://<dein-user>.github.io/<repo>/`

## Geräte‑Sync (Supabase) aktivieren

### 1) Supabase Projekt anlegen

- In Supabase ein neues Projekt erstellen.
- Unter **Authentication** → **Providers** sicherstellen, dass **Email** aktiv ist.

### 2) Datenbank Tabelle + Policies anlegen (SQL)

- In Supabase: **SQL Editor** öffnen
- Inhalt aus `supabase/schema.sql` ausführen

Damit gilt:
- Jede Ausgabe gehört zu genau einem `user_id`
- **Row Level Security** (RLS) ist aktiv: Nutzer sehen nur ihre eigenen Daten

### 3) Env Variablen setzen

- Datei `.env.example` kopieren nach `.env`
- Werte eintragen:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Danach Dev-Server neu starten:

```bash
npm run dev
```

### 4) In der App anmelden

In der App:
- Gehe zu `/#/login`
- **Registrieren** (einmalig) oder **Anmelden**
- Danach in der Budget-App auf **„Jetzt synchronisieren“** drücken

## Hinweise

- Die App ist **local-first**: Einträge werden immer lokal gespeichert; Sync gleicht anschließend ab.
- Lokal: Ohne `.env` läuft die App komplett lokal (kein Sync).
- Online (GitHub Pages): Env kommt über **GitHub Secrets** (nicht über `.env` im Repo).

