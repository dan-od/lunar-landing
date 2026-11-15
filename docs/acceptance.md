# Acceptance run, 2026-11-15

Every requirement in `docs/PRD.md`, with its result. Run against the `staging`
branch at the commit that adds this file.

**Where it ran.** There is no staging deployment: `moon-dev.okoro.me` does not
resolve, and the deploy workflow runs only for `main`. So the `staging` code was
run as a full local stack (server, Vite client, PostgreSQL with the seeded cache
and the 441 terrain profiles), and production (`moon.okoro.me`, which still runs
`main`) was used only for the deployment items. Setting up a staging deployment
needs DNS and host changes, which are the owner's to approve.

**Automated run.** `npm run typecheck`, `npm run lint`, `npm test` (250 tests:
54 core, 139 server, 57 client) and `npm run build` all pass. `gitleaks` over
the whole history: no leaks. axe-core: no violations on any of the five tabs at
desktop width. No sideways scrolling on any tab at 320 px, 390 px or 200% zoom.

Results: **Pass**, **Partly** (some of the check done, the rest named),
**Not built**, or **Not verified** (built, but the check needs something not
available here). "Test" means an automated test; "hand" means a run in a browser
or from the command line.

| ID | Result | Evidence |
| --- | --- | --- |
| F-1 | Pass | Test: parsed rows equal NASA's printed values on saved replies. Live spot check (earlier session) matched to six decimals at three times. |
| F-2 | Pass | Test: ten simultaneous loads, never two NASA requests at once. |
| F-3 | Pass | Test; hand: re-running the seed made no NASA requests for saved spans. |
| F-4 | Pass | Test on a saved reply at 0, 2 and 5 degrees. |
| F-5 | Pass | Hand: five sites, each row shows its source (`GET /v1/sites` lists 5). |
| F-6 | Pass | `tools/terrain/report.md`: worst direction error 0.0038°, F-6 pairing passes. |
| F-7 | Pass | Test: Miss odds, the `odds70` watch rule and `/v1/miss` agree for one aim. |
| 1-1 | Pass | Hand: first open offers the 2025 case or a site choice; one click loads it. |
| 1-2 | Pass | Every state has a symbol and a word; greyscale check (earlier session). |
| 1-3 | Pass | Test: bars are the calculator's windows. |
| 1-4 | Pass | Test: readouts at a marker time equal the calculator. |
| 1-5 | Pass | Hand: slip buttons and the date fields sit in the scenario bar on every tab; Compare side A, Miss and Watch follow the new date. |
| 1-6 | Pass | Test: every field round-trips through the address; hand: links restore the view. |
| 1-7 | Pass | Hand, forced in the dev build: loading bars, the unavailable banner with Retry and Add coordinates disabled with its reason, and the empty list with Load starter list and Add coordinates. |
| 1-8 | Pass | Hand: changing the margin changes the bars, and re-checks email watches. |
| 1-9 | Pass | Hand at 390 px: tabs in a bar at the bottom, no sideways scrolling, no control under 44 px. |
| 1-10 | Not built | No explain mode. The Help panel and the "?" beside each term give plain definitions instead. |
| 1-11 | Pass | Test (positions match readouts); hand: the Sun and Earth labels no longer overlap (layout test). |
| 1-12 | Pass | Test: entries across all sites, soonest first, and the first equals the earliest next change in the site list. Hand: on the 2025 case the first entry is sunrise at IM-2, T+7 h, the same as its Inspector; choosing it selects the site and moves the marker. |
| 1-13 | Pass | Test: a 2150 date opens the default date and says why, with the range 1960-01-01 to 2100-12-31 (range widened by the owner). |
| 2-1 | Pass | Hand: a new point (−85.5, 31.2) showed "fetching", then loaded real positions (Sun +2.3°) and could be selected. |
| 2-2 | Pass | Test; hand: 95 for latitude is refused with the message above the field and focus back on it. |
| 2-3 | Pass | Test: the request over the hourly limit gets a wait time. |
| 3-1 | Pass | Test; hand: each side has its own place, date (with Now) and hour. |
| 3-2 | Pass | Test: each quick setup gives the expected pairing. |
| 3-3 | Pass | Test: sentences match the numbers on each side. |
| 3-4 | Pass | Test: same place and time shows "No meaningful change". |
| 3-5 | Pass | Test: copied text equals the on-screen sentences. |
| 4-1 | Pass | 441 profiles, ±400 m in 40 m steps. |
| 4-2 | Partly | Shading equals the API grid. "A known crater appears dark" not checked: no cited crater position in the repository. |
| 4-3 | Pass | Test; hand: map click and arrow buttons move the aim and rings together. |
| 4-4 | Pass | Test: each line equals the share of working points in its ring (8, 6 and 5 out of 10 on the 2025 case). |
| 4-5 | Pass | Test: the safest spot is at least as good as any other grid aim (10 out of 10 at 160 m west, 120 m north). |
| 4-6 | Pass | Hand: the aim carries to Console, Compare and Watch; Watch pre-selects "Odds too low". |
| 4-7 | Pass | Hand and `GET /v1/miss?site=im1` (409 naming the site with terrain). |
| 5-1 | Pass | Test; hand with the development sender: a watch appears as waiting. |
| 5-2 | Pass | Test: a waiting watch with a broken rule sends nothing on re-check or on the daily check. |
| 5-3 | Pass | Test: a link older than 24 hours is refused and shows expired; a new link works. Hand: confirming made the watch active. |
| 5-4 | Pass | Test (a 10-day slip trips once; daily check); hand: raising the margin to 3° tripped it once, 3.5° sent nothing more, back to 2° logged "Rule holds again". |
| 5-5 | Pass by test | Test: the email text carries the same reason sentence as the log. No real email was sent (by rule); the owner tests with their own address. |
| 5-6 | Pass | Test: delete without the private link is refused; hand: delete through the Keep it dialog left 0 watch and 0 event rows. |
| 5-7 | Not built | Email only, as briefed; web (https) alert addresses were not built. |
| 6-1 | Pass by test | Row count equals windows on screen. Opening the file in a spreadsheet app not checked here. |
| 6-2 | Pass by test | `GET /v1/windows.ics`: one event per change with a reminder, CRLF, folded lines, escaped text. Importing into a calendar app not checked here (it would change the owner's calendar). |
| 6-3 | Not built | No status badge. |
| 7-1 | Pass | Hand from the command line: sites, sky and windows return correct replies. |
| 7-2 | Pass | Test: report and miss replies match the Compare and Miss screens. |
| 7-3 | Pass | Test for every endpoint, including the watch endpoints and dates not saved yet. |
| 7-4 | Pass | Hand: `lat=95` returns field `lat`, allowed `-90 to 90`. |
| 7-5 | Pass | Test: slip 0 equals the Console state. |
| 7-6 | Pass | Test: the `slip14` rule, `slip_impact` and `/v1/slip` agree. |
| 8-1 | Pass by test | Six read-only tools return the API's values. Not asked through a real assistant. |
| S-1 | Pass | `gitleaks`: no leaks. |
| S-2 | Pass | Test captures logs through create, confirm, alert and failure: no full address appears. Hand: logs show `p•••@example.org`. |
| S-3 | Pass | Test: a name starting with `=` exports as text; calendar text is escaped. |
| G-1 | Pass | Every commit is dan-od, no attribution lines; one merge has GitHub as committer (the web merge button). |
| A-1 | Pass | Keyboard run of flows 1, 3 and 4 (earlier session); new controls (Add coordinates, Help, tour, term hints, watch form, delete dialog) checked with real or scripted key presses (Tab, Return, Escape); not a full no-mouse run of every flow. |
| A-2 | Pass | Hand: focus returns to the opener after Settings, Help, the tour, the add form and the delete dialog. |
| A-3 | Pass | axe-core: no violations on any tab. |
| A-4 | Pass | States, watch statuses and changes all have a symbol and a word. |
| A-5 | Pass | With reduced motion nothing slides (drawer, tour) and Play jumps in 5-day steps. |
| A-6 | Pass | Timelines and maps have text equivalents (earlier session). |
| A-7 | Partly | Errors use `role=alert` and `aria-describedby` on their field. Not run with a screen reader. |
| A-8 | Partly | Messages such as "Watch is active" go to a polite live region without moving focus. Not run with a screen reader. |
| A-9 | Pass | No sideways scrolling at 320 px or at 200% zoom on any tab. |
| E-1 | Pass | `/miss` opened directly shows the Miss tab and its own title. |
| E-2 | Not verified | Preview image and tags exist; no chat app was available to paste into. |
| E-3 | Pass | The built page source holds a heading and a summary before scripts run. |
| E-4 | Pass | `robots.txt` and `sitemap.xml` load from the root. |
| D-1 | Partly | Production is public: `https://moon.okoro.me/`, `/v1/sites` and `/miss` answer 200 with no sign-in. Staging behind a sign-in does not exist. |
| D-2 | Pass | Production health answers 200; compose publishes no ports. |
| D-3 | Not built | Adding production to the uptime monitor is the owner's step. |
| P-1 | Pass | Hand: the privacy line sits above the Start watch button. |
| P-2 | Pass | Test: deleting a watch removes its row and events, and all watch data is purged after `WATCH_DATA_DELETE_AFTER`; hand: 0 rows after delete. |
| L-1 | Pass | `LICENSE`, `README.md` (sources, limits, how it was checked) and `CREDITS.md`. |
