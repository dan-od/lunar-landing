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

Seed the sites and the position cache (needs `DATABASE_URL`; calls NASA Horizons
one request at a time, Sun then Earth per site):

```bash
npm run seed --workspace server
```

```bash
npm run seed:cache --workspace server
```

Load the prepared terrain profiles for the demo site into the database (safe to
repeat; it replaces that site's profiles with the committed file):

```bash
npm run load:terrain --workspace server
```

The cache seed fetches 60 days hourly from 2025-02-04 for the five curated sites:
10 requests, 14,410 rows, about 13 seconds. Change the span with `SEED_START` and
`SEED_DAYS`. Spans outside the seed are fetched on first use and saved.

## API (version 1)

| Endpoint | Inputs | Returns |
| --- | --- | --- |
| `GET /v1/sites` | none | id, name, lat, lon, source, has_terrain |
| `GET /v1/sky` | `site` or `lat`+`lon`; `date`; `hour` (0), `margin` (2) | Sun and Earth direction and height; state word and symbol |
| `GET /v1/windows` | `site` or `lat`+`lon`; `start`; `hour` (0); `days` (30, up to 60); `margin` (2) | power and contact windows, uptime, longest gap, next change, hourly series |
| `GET /v1/windows.csv` | as `/v1/windows` | spreadsheet file: scenario and model in the first lines, then one row per window |
| `GET /v1/report` | `a_site` (or `a_lat`+`a_lon`), `a_date`, `a_hour` (0); the same for `b_`; `days` (30); `margin` (2) | verdict and five sentences, each marked better, worse or same, plus each side's numbers |

Every reply names the model. Errors name the field at fault and the allowed range
(400), the unknown site (404), the seconds to wait (429), or say that nothing is
saved (503). Every endpoint is rate limited per visitor (`RATE_LIMIT_PER_MINUTE`).

The Horizons client times out each request (`HORIZONS_TIMEOUT_MS`) and retries a
limited number of times with doubling waits (`HORIZONS_MAX_RETRIES`,
`HORIZONS_RETRY_BASE_MS`); it does not retry 4xx replies other than 429.

## Forcing states in a test build

In `npm run dev:client`, or a build made with `VITE_TEST_BUILD=1`, add
`force=loading`, `force=down` or `force=empty` to the address to see the loading,
service-unavailable and empty states. Production builds ignore it.

Copy `.env.example` to `.env` and fill in local values. No real secrets live in
the repository; production values come from the deployment pipeline.

## Full stack

`docker-compose.yml` runs three containers (client, server, database). Only the
client joins the shared `web` proxy network; the database is on an internal
network only; no ports are published. The server's health check answers at
`/api/health` on `127.0.0.1`.

## Deploy

`.github/workflows/deploy.yml` deploys production (moon.okoro.me) on a push to
`main`, or by hand. It syncs the code to the host, writes `.env` from repository
secrets, builds and restarts the stack, runs the migrations, seeds the sites and
the position cache, then checks `/api/health` and `/v1/sites`. The secret names
it expects are listed at the top of that file. The proxy site file is
`nginx/moon.conf`; copying it to the host is a one-time manual step.

## Credits

Every data source, library, font and asset is listed with its link and licence in
[CREDITS.md](CREDITS.md).

## Licence

MIT — see [LICENSE](LICENSE).
