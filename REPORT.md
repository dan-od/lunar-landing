# Moon Status: report for the owner

Written 2026-11-15 during the unattended session. The session stopped early
because the usage limit was reached, so the last step (Add coordinates) is only
half done; see "Stopped part-way".

## Where things are

| Branch | Commit | Holds |
| --- | --- | --- |
| `main` (pushed, deployed) | `fef7882` | Console, Compare (three setups), spreadsheet file, deploy workflow. No Miss. |
| `staging` (pushed) | see `git log` | Everything on `main`, plus Miss, the terrain loader, "Target vs my aim", accessibility and sharing passes, API tab, `/v1/slip`, the assistant connector, and the first half of Add coordinates. |

All commits are by dan-od with no co-author or tool lines. Nothing was force
pushed and no history was rewritten.

## Deploy (D-1, D-2)

Three attempts were used, all of them plumbing only.

| Attempt | Result | Cause and fix |
| --- | --- | --- |
| 1 (`9b5777c`) | Build and restart green; Migrate and seed green but **wrong** | Database settings fix worked. But only the migration ran: `docker compose exec` read the rest of the script from the SSH session, so the seed commands were skipped silently. |
| 2 (`daf75d2`) | Migrate and seed failed | Each `exec` now gets an empty input, and the step checks row counts. Sites seeded; the cache seed failed with `HorizonsHttpError: Horizons request failed: fetch failed` because the server container was on a Docker network marked `internal: true`, which blocks outbound traffic. |
| 3 (`fef7882`) | **Build and restart green, Migrate and seed green** | The stack's private network is now an ordinary named network (`moon-internal`), as in the dialed stack. Output: `Seeded 5 sites`, `Done: 14410 rows in 12.1s`, `sites in database: 5, cached position hours: 14410`. |

The smoke test fails with `curl: (22) The requested URL returned error: 502`,
as expected until the proxy file is installed.

## Needs your hands

1. **Install the proxy file (D-1).** On the homelab host:

   ```bash
   cp /opt/docker-homelab/sites/moon/nginx/moon.conf /opt/docker-homelab/nginx/sites/moon.conf
   docker exec nginx-proxy nginx -t
   docker exec nginx-proxy nginx -s reload
   curl -fsS https://moon.okoro.me/api/health
   curl -fsS https://moon.okoro.me/v1/sites
   ```

   The container name `nginx-proxy` and the paths are taken from the comment in
   your dialed proxy file; adjust if yours differ. The tunnel hostname
   `moon.okoro.me` must point at `http://nginx-proxy:80`.

2. **Check the stack on the host.**

   ```bash
   cd /opt/docker-homelab/sites/moon
   docker ps --filter name=moon --format 'table {{.Names}}\t{{.Status}}'
   docker compose exec -T db psql -U moon -d moonstatus -c 'SELECT count(*) FROM sites' < /dev/null
   ```

   An unused network from the first attempts may remain: `docker network ls | grep moon`.
   `moon-status_internal` can be removed with `docker network rm moon-status_internal`.

3. **Decide whether Miss goes to `main`.** It is on `staging` only. Merging
   `staging` into `main` deploys it; the workflow on `staging` also loads the
   441 terrain profiles and checks they landed.

4. **Decide the opening case (1-1).** With real positions the 2025 case at
   00:00 UTC opens as "no power" (Sun 1.7°, allowance 2°). At 17:00 UTC it reads
   ready. I changed nothing.

5. **Open the spreadsheet file in a spreadsheet app (6-1).** Not done here.

6. **Brand kit files.** The Space Apps logo and orbit pattern are not in the
   repository, so neither is shown. Nothing was drawn in their place.

7. **Watch (5-1 to 5-7).** Not started. It needs your email sending account and
   a decision on real email, which I must not send unattended.

8. **An assistant asking a question (8-1's hand check).** The connector answers
   a real client locally; nobody has asked it through an actual assistant.

9. **Local leftovers on your Mac.** `docker rm -f moon-pg-dev` removes my dev
   database; `server/.env` (git-ignored) points at it.

## Done

| Requirement | State | Evidence |
| --- | --- | --- |
| F-1 to F-5 | Done | Tests on saved NASA replies; live spot check matched to six decimals at three times. |
| F-6 | Done | `tools/terrain/report.md`; five sites agree on the Sun's overhead longitude to 0.01°. |
| F-7 | Done | Miss grid and `/v1/windows` with an aim agree for the same point (test). |
| 1-1 to 1-8, 1-11, 1-13 | Done | Tests plus browser checks against the API. |
| 3-1 to 3-5 | Done | Tests; all four quick setups work once an aim has been moved. |
| 4-1, 4-3 to 4-7 | Done | Tests on the real terrain file; browser checks against the API. |
| 4-2 | Partly | Shading equals the API's grid. "A known crater appears dark" is not verified: no cited crater position. |
| 6-1, S-3 | Done | File rows equal windows on screen; a name starting with `=` exports as text. |
| 7-1 to 7-5 | Done | Tests for every endpoint: good request, bad request, over the limit. |
| 7-6, 8-1 | Done by test | Six read-only tools return the API's values; `slip_impact` reads `/v1/slip`. Live local answer to "which sites survive a 10-day slip?": Chandrayaan-3 and Apollo 11. |
| A-1 | Done | Keyboard-only run of flows 1, 3 and 4 with real key presses. |
| A-2, A-3, A-6 | Done | Focus ring and return checked; axe-core reports no violations on every tab at desktop width. |
| A-4 | Done | Greyscale view: every state reads by symbol and word. |
| A-5 | Done | With reduced motion the marker jumps in 5-day steps. |
| E-1 to E-4 | Done locally | Title, description, canonical per tab; preview image; robots and sitemap. |
| S-1 | Done | `gitleaks` over the whole history: no leaks found. |
| G-1 | Done | Every commit is dan-od; one merge commit has GitHub as committer (the web merge button). |
| L-1 | Done | `LICENSE`, `README.md`, `CREDITS.md`. |
| 2-2 (server), 2-3 | Done by test | Bad latitude returns the range; the sixth new coordinate in an hour gets a wait time. |

## Stopped part-way

**Add coordinates (2-1, 2-2 on screen).** Committed and tested: the server limit
on new coordinates, a fix so each custom point has its own saved positions (it
previously shared one key with every other custom point), coordinate checks,
and custom points carried in the site id so a shared link works. **Not built:**
the form in the site list, and loading each site on its own so a new one shows
"fetching". A link such as `/?site=c:-85.2,31.5` already loads a custom point.

## Not started

- 1-9 phone layout with bottom tabs, 1-10 explain mode, 1-12 incident list.
- 5-x Watch, P-1, P-2, S-2 (all depend on Watch).
- 6-2 calendar file, 6-3 status badge, D-3 uptime monitor.

## Not verified

- A-7 to A-9, a screen reader run, and 200% zoom.
- The preview card in a real chat app, and a page-quality audit score.
- The deploy of anything on `staging` beyond what is on `main`.
- At 320 px the scanner flags overlapping pins on the pole map; the site list
  offers the same action.
- `npm audit` reports known issues in development dependencies; not examined.

## Things worth knowing

- **Compare says little for target against aim.** Point against point the
  30-day numbers barely differ; the real difference is the odds (6 against 10
  out of 10), which the five sentences do not cover.
- **The model does not reproduce the real 2025 failure.** The elevation map is
  80 m per pixel. The README says so.
- **`/api/health` reports ok even with an empty database.** The deploy step now
  checks row counts instead.
