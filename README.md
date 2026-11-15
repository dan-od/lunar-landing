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
- **Real terrain** is used on the **Miss** view and for an aim point carried from
  it, for the one demo site where horizon profiles are prepared from the LOLA
  elevation map: 441 points on a 40 m grid reaching 400 m from the target. The map
  is 80 m per pixel, so craters smaller than that are not seen. Odds count only
  prepared points, and the screen says when a ring reaches past them.
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
- **Space Apps brand** — colours and fonts only. The Space Apps logo and orbit
  pattern are not shown, because the original brand-kit files are not in the
  repository. No NASA insignia.

### Horizons step size (verified)

`STEP_SIZE=1h` is honoured by the Horizons API (verified against the live service;
the reply reported `Step-size: 60 minutes`). `12h` is also honoured; `3d` is
ignored. Azimuth is reported clockwise from north and elevation as height above the
local horizon, matching the convention used for terrain profiles.

## How we know it's right

Four checks stand behind the numbers. Each says what it proves and what it does
not. The same summary is in the app, on the API tab under "How we know it's
right" (also linked from Help and the status bar).

### 1. Positions equal NASA's own output

- **Saved replies.** `server/test/fixtures/` holds two raw NASA Horizons replies
  (Sun and Earth from the IM-2 target, 2025-03-06 to 2025-03-08, hourly). The
  tests parse them and require the parsed rows to equal NASA's printed values, for
  example Sun azimuth 74.592006° and height 1.726383° at 2025-03-06 00:00 UTC.
  Tests never call NASA.
- **The calculator on a saved reply.** On that reply the Sun is above the horizon
  100% of the time at a 0° shadow allowance, 86% at 2° and 0% at 5°, and Earth is
  up throughout. The tests require exactly those numbers.
- **Live spot check.** On 2026-11-15 the values the app had stored for the IM-2
  target were compared with a fresh Horizons request at three times (2025-03-06,
  03-18 and 03-31, 00:00 UTC). All six azimuths and heights matched to the sixth
  decimal place.
- **One request at a time.** A test starts ten page loads at once and requires
  that no two NASA requests overlap and that saved hours are not fetched again.

What this does not prove: that Horizons itself is right, or that the site
coordinates are (they are cited in [CREDITS.md](CREDITS.md), not re-measured).

### 2. Directions mean the same thing everywhere

A direction error would give shadows that look plausible and are wrong, so the
convention (degrees clockwise from north) is checked three ways.

- **NASA says so.** The Horizons reply header states that azimuth is measured
  clockwise from north.
- **The sites agree with each other.** From each of the five sites, the Sun's
  direction and height give the longitude where the Sun is overhead. At three
  different times all five sites, up to 84° of latitude apart, give the same
  longitude to within 0.01°. They could not agree if the directions were mirrored
  or rotated.
- **The terrain agrees with NASA (requirement F-6).** The terrain tools step
  across the elevation map along each direction and compare it with the true
  compass bearing on the Moon's sphere: the worst difference around the full
  circle is 0.0038°. See `tools/terrain/report.md`.

What this does not prove: the absolute height datum of the elevation map, which
was not checked against a second source.

### 3. The 2025 landing case

In March 2025 the IM-2 lander came down about 250 m from its target near Mons
Mouton, in a crater, got no sunlight on its panels, and its mission ended within
a day. The app opens on that target and date (2025-03-06 00:00 UTC). With real
positions and real terrain it shows:

- **The Sun is barely up.** At 00:00 UTC the Sun is 1.7° above a smooth horizon
  and Earth is 10.9° up. Under the default 2° shadow allowance the site reads
  "no power" until the Sun clears 2° seven hours later.
- **The target sits on the edge of a shadow.** Of the 441 prepared terrain points
  within 400 m of the target, 209 work and 232 do not. A lander that can miss by
  100 m works in 8 landings out of 10; by 250 m, 6 out of 10; by 320 m, 5 out
  of 10.
- **A safer aim exists.** Aiming 160 m west and 120 m north of the target, 10 out
  of 10 landings work at 250 m accuracy.

What this does and does not show, plainly:

- It shows that a few hundred metres decide the outcome at this site, which is
  the point of the Miss tab.
- It does **not** reproduce the real failure. The elevation map is 80 m per
  pixel, so a crater smaller than that is invisible to it, and the real lander
  also came to rest on its side. For a landing at 17:00 UTC the same day (close
  to the reported touchdown time), all 441 points work in this model.
- The actual touchdown point is not drawn on the map, because this repository
  has no cited position for it.

### 4. Apollo 11's actual landing

Apollo 11's lunar module touched down at Tranquility Base on 1969-07-20 at
20:17:39 UTC. The Apollo 11 site is in the starter list (0.67416 N, 23.47314 E,
from NASA NSSDC), so the same calculator can be asked about that moment.

| | Sun height at touchdown | Source |
| --- | --- | --- |
| Moon Status | **10.7°** (10.55° at 20:00, 11.06° at 21:00, read 17 minutes into the hour); Sun toward 88.8° from north | `GET /v1/sky?site=ap11&date=1969-07-20&hour=20` and `hour=21`, from NASA JPL Horizons positions, smooth-Moon model |
| NASA | **10.8°** | [Apollo by the Numbers (NASA SP-2000-4029), table "LM Lunar Landing", row "Sun Angle"](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-27_LM_Lunar_Landing.htm) |

The two agree to 0.1°. One caution: the same book lists 10.8° as the *targeted*
Sun elevation in its launch-windows table, so NASA's figure may be the planned
angle rather than a measurement at touchdown. Horizons positions are hourly, so
our value between the hours is a straight-line reading, not a separate request.

What this does not prove: anything about terrain. Apollo 11 landed on the open
mare, where a flat horizon is a fair model.

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
| `GET /v1/windows` | `site` or `lat`+`lon`; `start`; `hour` (0); `days` (30, up to 60); `margin` (2); optional `aim_east`+`aim_north` for an aim point on prepared terrain | power and contact windows, uptime, longest gap, next change, hourly series |
| `GET /v1/windows.csv` | as `/v1/windows` | spreadsheet file: scenario and model in the first lines, then one row per window |
| `GET /v1/report` | `a_site` (or `a_lat`+`a_lon`), `a_date`, `a_hour` (0); the same for `b_`; `days` (30); `margin` (2) | verdict and five sentences, each marked better, worse or same, plus each side's numbers |
| `GET /v1/slip` | `site` or `lat`+`lon`; `date`; `hour` (0); `margin` (2) | ready or not ready at the landing hour for each whole-day slip from −30 to +30; unknown where no positions are saved |
| `GET /v1/miss` | `site`; `date`; `hour` (0); `east`, `north` (aim, 0); `accuracy` (250) | terrain model: landings out of 10 that would work at 100, 250 and 320 m, the safest aim, and the grid of prepared points. 409 for a site without prepared terrain |

Every reply names the model. Errors name the field at fault and the allowed range
(400), the unknown site (404), the seconds to wait (429), or say that nothing is
saved (503). Every endpoint is rate limited per visitor (`RATE_LIMIT_PER_MINUTE`).

### Assistant connector

`POST /mcp` serves a Model Context Protocol connector (streamable HTTP, stateless)
with six read-only tools: `list_sites`, `get_windows`, `compare_sites`,
`slip_impact`, `miss_tolerance` and `change_report`. Each tool calls the
endpoints above on the same server, so an assistant gets exactly the app's
numbers, the model is named in every reply, and the same per-visitor limit
applies. It cannot start or delete anything.

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
