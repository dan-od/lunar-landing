# Moon Status

A web app for the 2026 NASA Space Apps challenge *Lunar Landing Site Navigator*.
It answers one question: at a given place on the Moon and a given time, does a
lander have **sunlight for power** and a **line of sight to Earth**?

Pick a landing site near the south pole and a date, and see at a glance whether a
lander would be ready, plus a 30-day timeline, a plain-language change report, a
map of what happens if the lander misses its target, and alerts when a schedule
change turns a good site bad.

## What is modelled, and what is not

- Positions of the Sun and Earth come from **NASA's JPL Horizons** system,
  computed server-side and cached.
- By default the app uses a **smooth-Moon model**: the reference sphere plus a
  *shadow allowance* that stands in for hills the smooth model cannot see.
- **Real terrain** (crater rims, ridges) is used only on the **Miss** view, for the
  one demo site where horizon profiles are prepared from the LOLA elevation map.
- Every reply and exported file names the model it used (smooth Moon or terrain).
- Not modelled: radio link quality, thermal/battery behaviour, disc size of the
  Sun or Earth (centre of body only).

## Data sources

- **NASA JPL Horizons API** — Sun (`COMMAND=10`) and Earth (`COMMAND=399`)
  azimuth and elevation from a point on the Moon (`coord@301`, geodetic
  east-longitude / latitude / height-km), quantity 4, hourly.
- **LOLA south pole elevation map** — `LDEM_80S_80MPP_ADJ.TIF` (181 MB, 80 m/px),
  used to prepare terrain horizon profiles for the demo site. Not committed to the
  repository (it lives under `data/`, which is git-ignored).
- **Space Apps brand assets** — colours and fonts only; the Space Apps logo is used
  unaltered. No NASA insignia.

### Horizons step size (verified)

`STEP_SIZE=1h` is honoured by the Horizons API (verified against the live service;
the reply reported `Step-size: 60 minutes`). `12h` is also honoured; `3d` is
ignored. Azimuth is reported clockwise from north and elevation as height above the
local horizon, matching the convention used for terrain profiles.

## Layout

```
core/     shared types and the one window calculator (used by server and client)
server/   Express API, the request queue, the cache, and all contact with NASA
client/   React + TypeScript + Vite single-page front end (five tabs)
docs/     the PRD ("Moon Status: flow by flow") and the flow prototype
data/     the LOLA elevation map and prepared terrain (git-ignored)
```

## Develop

Requires Node 20+ and (for the full stack) Docker.

```bash
npm install            # install all workspaces
npm run build          # build core, then server, then client
npm run typecheck      # type-check every workspace
npm run lint           # eslint
npm test               # run unit tests
```

Run the pieces locally:

```bash
npm run dev:server     # Express on :8080 (needs DATABASE_URL for the cache)
npm run dev:client     # Vite on :5173, proxying /api to :8080
```

Database migrations (needs a running PostgreSQL and `DATABASE_URL`):

```bash
npm run migrate
```

Copy `.env.example` to `.env` and fill in local values. No real secrets live in
the repository; production values come from the deployment pipeline.

## Full stack

`docker-compose.yml` runs three containers (client, server, database). Only the
client joins the shared `web` proxy network; the database is on an internal
network only; no ports are published. The server's health check answers at
`/api/health` on `127.0.0.1`.

## Licence

MIT — see [LICENSE](LICENSE).
