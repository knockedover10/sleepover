# Sleepover

A collaborative trip planner for groups. Plan itineraries, split expenses, manage tasks, and share travel documents — all in real time, no accounts required. Share by link.

## Features

- **Itinerary** — drag-free day-by-day timeline with location search (Nominatim)
- **Map** — Leaflet view with OSRM walking routes & day filters
- **Budget** — multi-currency expenses, 4 split modes (equal / custom / percent / itemized), receipt photos, settle-up
- **Tasks** — assignable to-dos with categories and filter chips
- **Documents** — upload PDFs / images, private or shared, IndexedDB offline cache
- **Reminders** — flight check-ins, weather alerts, task due-dates, all client-side
- **Real-time sync** — Supabase realtime channels for instant collaboration
- **PWA** — installable, works offline, custom theme

## Tech stack

- **Frontend**: Vite + React + TypeScript, Tailwind CSS, shadcn/ui, wouter (hash routing), TanStack Query, Framer Motion
- **Backend**: Supabase (Postgres + RLS + Storage + Realtime)
- **Maps**: Leaflet + OSM tiles, OSRM routing, Nominatim geocoding
- **Weather**: Open-Meteo
- **Local persistence**: idb-keyval (device ID, document cache)
- **Build**: tsx + esbuild → Express static server

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a Supabase project at <https://supabase.com>
2. Open the SQL Editor in your Supabase dashboard
3. Paste the contents of [`supabase/migration.sql`](./supabase/migration.sql) and run it
   - This creates all tables, RLS policies, storage buckets, and the security-definer RPCs needed for join-by-token
4. Verify the migration succeeded by visiting **Database → Tables** — you should see `trips`, `travelers`, `itinerary_items`, `expenses`, `expense_splits`, `tasks`, `task_assignees`, `documents`, `currencies`, `dismissed_reminders`

### 3. Configure environment

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon (publishable) key:

```bash
cp .env.example .env.local
# edit .env.local
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

> **Note**: never commit your real `.env.local`. The `.gitignore` already excludes it.

### 4. Run dev server

```bash
npm run dev
```

App is served on `http://localhost:5000`.

### 5. Build for production

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## How it works

Sleepover uses **device IDs** (UUID stored in IndexedDB) instead of accounts. When you create a trip, your device becomes a "traveler". Sharing the invite link lets others join — they pick their own name and color.

RLS policies on Supabase enforce that the request must come from a known device for that trip (via the `x-device-id` header). The exception is the join flow: a public `join_trip(token, name, color, device_id)` RPC creates a traveler row given a valid invite token.

## Routes

- `/#/` — landing page (your trips, create / join)
- `/#/t/:invite_token` — trip overview (you'll be prompted to join if you haven't yet)
- `/#/t/:invite_token/itinerary` — day-by-day plan
- `/#/t/:invite_token/map` — map view with routes
- `/#/t/:invite_token/budget` — expenses + settle-up
- `/#/t/:invite_token/tasks` — to-dos
- `/#/t/:invite_token/documents` — file vault
- `/#/t/:invite_token/settings` — trip details, currencies, leave/delete, demo reset

## License

MIT
