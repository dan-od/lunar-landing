# Moon Status

A web app for the 2026 NASA Space Apps challenge *Lunar Landing Site Navigator*.
It answers one question: at a given place on the Moon and a given time, does a
lander have **sunlight for power** and a **line of sight to Earth**?

Pick a landing site and a date (any day from 1960 to 2100, in UTC) and see at a
glance whether a lander would be ready. Live at https://moon.okoro.me.

## What it does

| Tab | Answers |
| --- | --- |
| **Console** | Is each site ready at the landing moment (a symbol and a word: ready, no power, no link, dark)? A pole map, a 30-day sunlight and Earth-contact timeline with a slider and Play, a sky view, and the next sunrise or sunset. Add your own coordinates; download the windows as a spreadsheet. |
| **Compare** | Two cases side by side (place, date and hour each), four quick setups, and a change report: a verdict and five plain sentences marked better, worse or the same. |
| **Miss** | If the lander comes down 100, 250 or 320 m off target, how many landings out of 10 still work, on real terrain? Move the aim, or jump to the safest nearby spot, and carry it to the other tabs. |
| **Watch** | The upcoming sunrises, sunsets, Earth rises and Earth sets for the 30 days after landing, each with Add to calendar (a calendar file with a reminder). Where email alerts are switched on, a confirmed email watch sends one alert when its rule breaks. |
| **API** | The same answers by program, sent live from the page, plus an assistant connector and "How we know it's right". |

Every tab has a Help panel (what it answers, three steps, what each number
means), a "?" beside each term, and the Console has a four-step first-visit tour.
The landing date and hour are real fields with a "Now" button, the scenario lives
in the page address so links restore the view, and on a phone the tabs move to a
bar at the bottom.

## What is modelled, and what is not

- Positions of the Sun and Earth come from **NASA's JPL Horizons** system,
  computed server-side and cached.
- By default the app uses a **smooth-Moon model**: the reference sphere plus a
  *shadow allowance* that stands in for hills the smooth model cannot see.
- **Real terrain** is used on the **Miss** view and for an aim point carried from
  it, for the three sites where horizon profiles are prepared from the LOLA
  south-pole elevation map: the **IM-2 target** (Mons Mouton), **IM-2 Athena where
  it came to rest**, and the **Shackleton–de Gerlache ridge**. Each has 441 points
  on a 40 m grid reaching 400 m from the site, seen by a 2 m observer with rays out
  to 150 km; every ray stayed on the map. The map is 80 m per pixel, so craters
  smaller than that are not seen. Odds count only prepared points, and the screen
  says when a ring reaches past them.
- **Sites without terrain** say why, and nothing is estimated: sites north of 80° S
  are outside the south-pole elevation map (it covers 80 to 90 degrees south); IM-1
  is at the edge of the map, so the horizon would be cut off.
- Every reply and exported file names the model it used (smooth Moon or terrain).
- Not modelled: radio link quality, thermal/battery behaviour, disc size of the
  Sun or Earth (centre of body only).

## Data sources

Every source is listed with its link and licence in [CREDITS.md](CREDITS.md).

- **NASA JPL Horizons** ([system](https://ssd.jpl.nasa.gov/horizons/),
  [API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html)) — Sun
  (`COMMAND=10`) and Earth (`COMMAND=399`) azimuth and elevation from a point on
  the Moon (`coord@301`, geodetic east-longitude / latitude / height-km),
  quantity 4, hourly. Called only by the server, one request at a time, and every
  reply is saved and reused.
- **LOLA south pole elevation map** (NASA Goddard, Lunar Orbiter Laser Altimeter)
  — `LDEM_80S_80MPP_ADJ.TIF` (181 MB, 80 m/px), used to prepare terrain horizon
  profiles for the demo site. Not committed to the repository (it lives under
  `data/`, which is git-ignored). Product page:
  [PGDA, "A New View of the Lunar South Pole from LOLA"](https://pgda.gsfc.nasa.gov/products/90)
  (NASA Goddard Planetary Geodesy Data Archive). Cite: Barker et al., 2023,
  *Planet. Sci. J.* 4, 183, [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1).
- **Site coordinates** — 21 sites in three groups (South pole, Apollo, Other
  landers). NASA's nine Artemis III candidate regions (2024) are **not listed**:
  NASA published them as named regions without centre points, and no citable
  centre point could be found, so none is shown rather than guessed. Sources: NASA NSSDC
  ([lunar landing sites](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html)),
  NASA ([IM-1](https://www.nasa.gov/?p=620655)) and LROC (Arizona State
  University for NASA). Each site's link is stored with it and shown in the
  Inspector; [CREDITS.md](CREDITS.md) lists them all. Sites whose coordinates
  could not be cited were left out, never estimated.
- **Apollo 11 Sun angle** — [Apollo by the Numbers, NASA SP-2000-4029](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-27_LM_Lunar_Landing.htm),
  used only for the check below.
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

In March 2025 the IM-2 lander came to rest about 370 m from its target near Mons
Mouton (computed from the LROC coordinates of the target and of the resting point), in a crater, got no sunlight on its panels, and its mission ended within
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

### 5. Coarser maps checked against the 80 m map

Some sites fall outside the 80 m south-pole map, so their terrain is prepared
from the 120 m polar maps or the ~240 m whole-Moon map. To see what that costs,
the three sites that have 80 m profiles (IM-2 target, IM-2 Athena, and the
Shackleton–de Gerlache ridge) were recomputed from the 120 m south map and the
horizons compared around the full 360° circle:

| Site | Largest difference | Average |
| --- | --- | --- |
| IM-2 target | 1.67° | 0.03° |
| IM-2 Athena (resting point) | 1.78° | 0.05° |
| Shackleton–de Gerlache ridge | 6.93° | 0.66° |

On ordinary ground the two maps agree to a fraction of a degree. The large
numbers are confined to Shackleton's sharp crater rim, where a horizon set by a
single ridge is sensitive to the pixel size — up to about 7°. Because of this,
odds computed from the 120 m and whole-Moon maps are shown with a plain caution
in the Miss tab and treated as approximate. Regenerate with
`tools/terrain/validate_120m.py`.

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

Database migrations (needs a running PostgreSQL and `DATABASE_URL` in the
environment; the scripts do not read `.env` themselves, so either export it or
run `npx tsx --env-file=.env src/db/migrate.ts` in `server/`):

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

Load every prepared terrain profile file (`tools/terrain/<site>_terrain.json`)
into the database (safe to repeat; it replaces each site's profiles with its
committed file; the deploy runs it after seeding the sites). To build a file:
`cd tools/terrain && .venv/bin/python build_profile.py <im2|im2a|shk>`.

```bash
npm run load:terrain --workspace server
```

The cache seed fetches, for every curated site (21, one NASA request at a time,
about two minutes the first time), 60 days hourly from
2025-02-04 (the 2025 case), Apollo 11's landing day, and the 60 days starting
today (UTC), so the Now button opens on saved positions. It asks NASA only for
hours not already saved, so running it twice is safe (the second run makes no
requests). Change the spans with `SEED_START`, `SEED_DAYS` and `SEED_TODAY_DAYS`.
Any other date from 1960 to 2100 is fetched on first use and saved; each visitor
may open `NEW_PERIODS_PER_HOUR` such new dates an hour (saved dates are not
counted).

## API (version 1)

| Endpoint | Inputs | Returns |
| --- | --- | --- |
| `GET /v1/sites` | none | id, name, lat, lon, source, has_terrain |
| `GET /v1/sky` | `site` or `lat`+`lon`; `date`; `hour` (0), `margin` (2) | Sun and Earth direction and height; state word and symbol |
| `GET /v1/windows` | `site` or `lat`+`lon`; `start`; `hour` (0); `days` (30, up to 60); `margin` (2); optional `aim_east`+`aim_north` for an aim point on prepared terrain | power and contact windows, uptime, longest gap, next change, hourly series |
| `GET /v1/windows.csv` | as `/v1/windows` | spreadsheet file: scenario and model in the first lines, then one row per window |
| `GET /v1/windows.ics` | as `/v1/windows`; `remind` (minutes before, 60); optional `at` + `kind` (`sunrise`, `sunset`, `earthrise`, `earthset`) for one change | calendar file of the upcoming changes, each with a reminder and the model named |
| `GET /v1/report` | `a_site` (or `a_lat`+`a_lon`), `a_date`, `a_hour` (0); the same for `b_`; `days` (30); `margin` (2) | verdict and five sentences, each marked better, worse or same, plus each side's numbers |
| `GET /v1/slip` | `site` or `lat`+`lon`; `date`; `hour` (0); `margin` (2) | ready or not ready at the landing hour for each whole-day slip from −30 to +30; unknown where no positions are saved |
| `GET /v1/miss` | `site`; `date`; `hour` (0); `east`, `north` (aim, 0); `accuracy` (250) | terrain model: landings out of 10 that would work at 100, 250 and 320 m, the safest aim, and the grid of prepared points. 409 for a site without prepared terrain |
| `GET /v1/watches/config` | none | whether email alerts are on here, the four rules, and the privacy line |
| `POST /v1/watches` | JSON: `site`, `date`, `hour`, `margin`, `accuracy`, optional `aim_east`+`aim_north`, `rule` (`power`, `link3`, `slip14`, `odds70`), `email` | the watch as waiting, and its private manage token; a confirmation email is sent. 404 when email alerts are off |
| `POST /v1/watches/confirm`, `/lookup`, `/recheck`, `/:id/resend`; `DELETE /v1/watches/:id`; `GET`/`POST /v1/watches/unsubscribe` | confirmation token, or manage tokens | confirm (link valid 24 hours), list with event log, re-check after a scenario change, send a new link, delete; unsubscribe: `GET` shows a Stop alerts page, `POST` (the button, or a mail app's one-click) deletes the watch and its address |

Dates run from 1960-01-01 to 2100-12-31 (UTC). Every reply names the model.
Errors name the field at fault and the allowed range (400), the unknown site
(404), the seconds to wait (429), or say that nothing is saved (503). Every
endpoint is rate limited per visitor (`RATE_LIMIT_PER_MINUTE`); new custom
coordinates (`CUSTOM_SITES_PER_HOUR`), dates not saved yet
(`NEW_PERIODS_PER_HOUR`) and new watches (`WATCHES_PER_HOUR`) have hourly limits
of their own.

### Watch by email

Email alerts are **off unless both `EMAIL_SENDING_KEY` and `TOKEN_SIGNING_SECRET`
are set** (and a database is configured). When off, the watch endpoints answer
404, no daily check runs, the page hides the form, and the calendar buttons stay.

- Mail goes through Resend's API from `Moon Status <moon@okoro.me>`.
- Nothing is sent to an address until its owner opens the confirmation link,
  which expires after 24 hours and can be sent again.
- Rules are re-checked when the watched scenario changes and once a day, with the
  same calculator as the API (`slip14` reads the `/v1/slip` result, `odds70` the
  `/v1/miss` result). One alert per break, never one per check, at most 5 a day
  per watch.
- Every email has an unsubscribe link and the `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers (RFC 8058), so a mail app's own unsubscribe
  button works in one click. Opening the link only shows a page with a "Stop
  alerts" button, so a mail scanner that follows links deletes nothing; the
  button (or the mail app's one-click request) deletes the watch and its address. All watch data is deleted after
  `WATCH_DATA_DELETE_AFTER` (default 2026-12-15, 30 days after the event).
- Tokens are stored only as keyed hashes and compared in constant time; logs and
  events show addresses masked (`d•••@example.org`).
- In development, `EMAIL_SENDER=fake` (with `TOKEN_SIGNING_SECRET`) sends nothing
  and logs the links instead. It is ignored in production. Tests use a fake
  sender only.

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

Copy `.env.example` to `.env` and fill in local values; it names every setting.
No real secrets live in the repository; production values come from the
deployment pipeline's secrets (`MOON_DB_PASSWORD`, `EMAIL_SENDING_KEY`,
`TOKEN_SIGNING_SECRET` and the deploy access secrets listed in the workflow).

## Full stack

`docker-compose.yml` runs four containers (client, server, database, terrain
worker). Only the client joins the shared `web` proxy network; the database and
the worker are on an internal network only; no ports are published. The server's
health check answers at `/api/health` on `127.0.0.1`; the worker's is a
heartbeat file it touches each loop.

## Terrain worker

Any site inside a downloaded elevation map gets a real horizon profile
automatically, kept until the map version changes. The pieces:

- **Map catalogue** `tools/terrain/maps.json`: the LOLA maps, best-first — 80 m
  south (GeoTIFF), 120 m south and north (PDS), and the 128 px/deg whole-Moon map
  (PDS, the equirectangular fallback, seam handled). `tools/terrain/maps.py` reads
  each map through its GeoTIFF CRS or PDS label, verifying projection and units
  rather than assuming, and chooses the finest map that covers a point with the
  full 150 km ray range inside it.
- **Maps volume**: `tools/terrain/download_maps.py` fills a named Docker volume
  (`maps`) from the catalogue URLs, resuming and size-checking. Maps are never in
  git or an image.
- **Queue + worker**: the server queues a job for any built-in site without
  terrain, any new custom site (at most 5 per visitor per hour), and any site
  whose map has a newer version. The `moon-terrain-worker` container computes jobs
  one at a time, skipping a site/grid/map-version already done, waiting when no
  downloaded map yet covers the site, and backing off on error. Results go to
  `horizon_profiles` with the map name and version.
- **Status**: `GET /v1/terrain/status?site=` reports `none` / `preparing` /
  `ready` with the map and resolution; the Miss page shows "Preparing terrain…"
  until it is ready and then names the map ("terrain from LOLA 120 m").

## Deploy

`.github/workflows/deploy.yml` deploys production (moon.okoro.me) on a push to
`main`, or by hand. It syncs the code to the host, writes `.env` from repository
secrets, builds and restarts the stack, runs the migrations, seeds the sites and
the position cache, then checks `/api/health` and `/v1/sites`. The secret names
it expects are listed at the top of that file. The proxy site file is
`nginx/moon.conf`; copying it to the host is a one-time manual step.

## What's next

Not built yet; these are the next steps.

- **Terrain for any site, on its own.** A background worker on the server will
  compute the horizon grid for any site as soon as it is added, including a
  visitor's own coordinates, and keep the result until NASA publishes a newer
  elevation map. The Miss view then works wherever the map reaches, without a
  manual build step.
- **More of the Moon.** Adding NASA's elevation maps for 60 to 70 degrees south and
  NASA's global map would extend the Miss view to Chandrayaan-3 and the Apollo
  sites, which are outside today's south-pole map.

## Use of AI tools

AI assistance was used heavily in this project, and the Space Apps rules allow
it. This is what it did, as far as the repository shows:

- **Claude (Anthropic), through Claude Code**, wrote most of the code, tests and
  documentation in this repository under the owner's direction: the server,
  calculator, client, terrain tooling, deploy workflow, README, CREDITS and the
  build reports. It also ran the checks recorded in `REPORT.md` (tests, browser
  checks, accessibility scans) and researched sources such as the Apollo 11 Sun
  angle. Several Claude models were used across sessions. Its shared project
  configuration is in the `.claude/` folder: `settings.json` (no attribution
  lines in commits or pull requests) and `launch.json` (the local client and
  server). Personal settings, worktrees and session history are not committed.
- **The product document and flow prototype** (`docs/PRD.md`,
  `docs/prototype/index.html`) were drafted with an AI assistant in chat and
  reviewed by the owner screen by screen.


## Use of AI tools

AI assistance was used for implementation and boilerplate generation within the Space Apps guidelines, while all product design, architecture, domain logic, and verification were directed by the owner:

- **Architecture, product design, and domain logic (Owner):** Defined the system
  architecture, data pipeline (NASA Horizons and LOLA elevation models), user flows
  (`docs/PRD.md`, `docs/prototype/index.html`), and core mathematical requirements.
  Reviewed every screen, PR, and calculation against primary sources
  (such as the Apollo 11 Sun angle).
- **Implementation and tooling (Claude / Claude Code):** Used as a pair-programming
  and scaffolding tool to translate specifications into TypeScript/React code, tests,
  CI/CD workflows, and documentation (`README.md`, `CREDITS.md`, `REPORT.md`).
  Project-level constraints in `.claude/settings.json` and `.claude/launch.json`
  governed code style and local execution.

Every number shown comes from NASA data through the code, not from an AI model:
the app itself makes no AI calls. The assistant connector (`/mcp`) only lets an
outside assistant read the app's own numbers.

## Credits

Every data source, library, font and asset is listed with its link and licence in
[CREDITS.md](CREDITS.md).

## Licence

MIT — see [LICENSE](LICENSE).
