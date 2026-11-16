# Moon Status: report for the owner

Written 2026-11-15, end of the second unattended session (started about
06:30 EST). Every step of your list, and both later additions, was done and pushed to
`staging` after each step. `main` and production were deployed twice with the owner's approval (see Production deploys). The later phone redesign is on `staging` only, not deployed. All commits
are dan-od with no tool lines; nothing was force-pushed.

The full requirement-by-requirement result is in
[docs/acceptance.md](docs/acceptance.md). Screenshots of each tab on the 2025
case are in [docs/screens/](docs/screens/).

## Final round (2026-11-15 evening; production deploy approved by the owner)

Production runs `d0a5451` (deploy run 43790362232, green). `staging` is ahead
of `main` only by the deck and this report.

| Step | Result | Commit |
| --- | --- | --- |
| 1. Console fits the window | From 900 px up, the Console page never scrolls: header, scenario bar, panes and status bar fill 100dvh. The site list (title and search pinned above it), the inspector and the timeline area scroll on their own; the polar map fills the rest. The selected site is scrolled into view in the list (only the list moves). Other tabs and the phone layout are unchanged. | `2b55286` |
| 2. Timeline | Desktop shows only the chosen site; "SHOW ALL 21 SITES" toggles the rest and is remembered (localStorage `moon:timeline-all`). Legend "POWER (Sun up)" / "LINK (Earth in view)" beside the timeline, the phone card's strip and timeline, and each Compare side; the percentage column is labelled "POWER / LINK". | `8d95cac` |
| 3. Consistency | IM-2 came to rest about 370 m from the target (369.7 m on the map's projection, 368.9 m great circle, from the LROC coordinates −84.78, 29.13 and −84.7906, 29.1957) in How we know it's right, the site note and the README. Site list, inspector and card use "84.7800 S, 29.1300 E". Phone Miss intro: "Tap the map to read a point, then press Move aim here." | `e8d18b5` |
| 4. Terrain for two more sites | Done inside the time box (builds took about 3 s each). `shk_terrain.json` (Shackleton–de Gerlache ridge, −89.684, 196.739) and `im2a_terrain.json` (IM-2 Athena's resting point, −84.7906, 29.1957): 441 points, 40 m, 400 m, 2 m observer, 150 km rays. **No ray left the map at either site** (the files record `rays_cut_directions_deg: []`). The loader now loads every `<site>_terrain.json`, one transaction each, safe twice; the deploy loaded 1,323 profiles. The aim belongs to the terrain site last chosen (picking another resets it). Sites without terrain say why, per site, in Miss and the API's 409: north of 80° S "outside the south-pole elevation map (it covers 80 to 90 degrees south)", IM-1 "at the edge of the map, so the horizon would be cut off"; "Nothing is estimated" kept; the 409 lists the three terrain sites. | `f70d5dc` |
| 5. README What's next | Background terrain worker for any site including custom coordinates, kept until NASA publishes a newer map; NASA's 60–70° S and global maps for Chandrayaan-3 and the Apollo sites. | `d0a5451` |
| 6. Deploy | Tests, lint, typecheck, build, axe; `main` fast-forwarded to `staging` and pushed; run watched to green; live bundle checked for the new code; `/v1/sites` lists im2, shk, im2a with terrain; `/v1/miss?site=shk` 200; `/v1/miss?site=im1` gives the new 409. | — |
| 7. Deck | Rebuilt from https://moon.okoro.me (screens in `docs/demo/screens/`). `/v1/windows`, 15–22 Nov 2026 from 00:00 UTC: Apollo 11 power 96%, link 100%; Chang'e 4 link 0% all week; Shackleton power 0% (dark), link 38%; IM-2 power 99%, link 86%. The "today" slides use 15 Nov 2026 12:00 UTC. Seven slides, rendered and checked: no overlap or overflow. | `08ab00a` |

### Verified by automated test

- 296 tests pass: 64 core, 141 server, 91 client. Lint, typecheck and build clean.
- New: no-terrain reasons (map edge, outside, custom); every terrain file is found, parses on the same 441-point grid and is centred on its site's cited coordinates; the three terrain sites are the curated ones with `hasTerrain`.
- Earlier ones still pass: LOLA projection against the terrain tool, offset wording.

### Verified by hand (scripted Chromium against the dev stack, then the live site)

- Console at 1512×982, 1280×800, 1920×1080 and 900×700: page height equals the window, no sideways scroll, axe clean.
- At 1512×982 the mouse wheel scrolls the list, inspector and timeline area and never the page. Focusing the last row scrolls it into view; a deep-linked site (Apollo 17) is visible in the list on load.
- Phone states at 320 and 390 px and the Miss states at 1440 and 320 px: axe clean, no sideways scroll. The one small target is the inline link inside a sentence on the API tab, as before.
- Phone keyboard checks (chips, tabs, card focus, Back, date sheet) pass.
- Miss works for Shackleton and IM-2 actual on the dev stack and live. IM-1 and Chandrayaan-3 show their reasons. The loader ran twice locally with the same row counts.
- Live: the deploy loaded im2, im2a and shk. The bundle has the new layout, toggle and legend. The connector's `slip_impact` answers (its reply is on slide 7).

### Not verified (and why)

- **The PDF is not PowerPoint's export.** Exporting through PowerPoint was refused by this session's permission check. `docs/demo/moon-status-demo.pdf` is made from my own renders of each slide (real Fira Sans, Overpass and Fira Code at the deck's exact positions, 220 dpi images, so its text is not selectable). Line breaks in PowerPoint may differ slightly. To replace it, open the .pptx in PowerPoint and use File › Export › PDF.
- Real phones, real screen readers, Firefox and Safari: not tried; Chromium only.
- A shared link to a moved aim does not say which terrain site it belongs to; it opens on the IM-2 target's grid. A fix would need a change to the URL contract, so I left it.
- The connector's `slip_impact` echoes the site id as `"name"` when one site is asked for (`"name": "im2"`); it is cosmetic and left as is.
- `docs/PRD.md` still says "about 250 m" in three places. It is the requirements document, so I did not edit it.

## The two queued additions

Both were received and built (date jumps under C, and the grown site list after
item 1).

| Addition | Result |
| --- | --- |
| C: large date jumps | The date field is typable (YYYY-MM-DD) with our own calendar popup beside it: month and year dropdowns at the top, previous and next month arrows, and a day grid. Picking a day sets the date and closes it. Keyboard: arrows move by day or week, Page Up/Down by month (Shift: year), Home/End, Enter picks, Escape closes and returns focus. Today (•) and the selected day (✓) are marked with a symbol, not colour alone. New step buttons: −1 mo, +1 mo, −1 y, +1 y (31 January + 1 month = 28 February). Every error names the allowed range. The hour stays a separate field. The browser's own popup was not needed. |
| Rule B everywhere | One shared `Select` component renders every dropdown, including the new month and year ones; a test fails if a plain `<select>` appears anywhere else. |
| Grown site list | 21 sites, up from 5, in three groups: South pole (6), Apollo (6), Other landers (9). Each has its source link, shown in the Inspector, and a note where needed (crash site, converted longitude). There is a search box. The deploy seed covers all of them, one request at a time; a second run made no NASA requests (126 of 126 from the cache). Miss stays unavailable for every site but the IM-2 target, with the reason shown. |
| **Artemis III candidates: none listed** | NASA's release names the nine regions but gives no coordinates, and no NASA, LROC or peer-reviewed page with a centre point per region could be found and quoted. Per your rule, none is listed, and the list has no Artemis III group; Help and the README explain why. **ispace Resilience** is left out for the same reason. |
| IM-2 actual resting point | Added as its own site ("IM-2 Athena, where it came to rest", LROC), about 370 m from the target. |
| Map labels | Site names on the pole map no longer overlap: a crowded name moves to the left of its pin or is left off. |

New tests for these: calendar grid and keyboard moves, month and year steps,
the Select guard, site groups and search, the grown list (every site grouped
and cited), `GET /v1/sites` groups, pin label placement. Totals now: 57 core,
140 server, 72 client tests, all passing; axe clean on every tab; no sideways
scrolling at 320 px or 200% zoom. Checked by hand: picking December 2026 in two
dropdown picks, keyboard moves, Escape, typed errors, the popup as a sheet at
320 px with 44 px day cells, search, a crash site's link and note, Miss on
Vikram. Not checked: the popup in Firefox (it would not launch here) and with a
screen reader.

## Production deploys (approved by the owner)

| Deploy | Commit | Result |
| --- | --- | --- |
| 1 | `ed6a47b` (items 1–3) | Run 43715782417: every step green. Migration `002_watches.sql` applied; 21 sites seeded; position seed 80.6 s; 125,166 cached hours; 441 terrain profiles; smoke tests 200 and 200. Checked after: health ok with database, 21 sites in three groups, email alerts on, Apollo 11 from saved positions, calendar file, all five tabs and the icons 200. |
| 2 | `7f3dee6` (polish, checkpoint) | Run 43716366326: every step green. No new migrations; seed done in 2.0 s with no new rows (safe to run twice, shown in production); smoke tests 200 and 200; health ok; the phone More toggle is in the live bundle. |

## Owner's follow-ups (later on 2026-11-15)

| Item | Result |
| --- | --- |
| Unsubscribe | Opening the link only shows a page with a "Stop alerts" button; the button's POST deletes. Mail apps' own unsubscribe works through the `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (a POST to the same address). Tested by test and live: opening the link kept the watch, the button deleted it, a one-click POST deleted another with its events. |
| Artemis III | No empty group in the list; Help and the README say NASA published the nine regions without centre points, so they are not listed. |
| Phone | The scenario bar shows only date, hour and Now; the seven step buttons open from a More toggle, and the slip "?" sits beside it, not in the grid. |
| Labels | Pole-map names avoid the rim and the rings as well as each other (and have a dark backing); the Sun and Earth names sit on the outer side of their dots. Sky-view labels avoid the horizon, the allowance line and the frame edges, with a dark halo. |

## Miss coordinates and the slip group (on staging, not deployed)

Screenshots: `docs/screens/miss-coords.png`, `miss-coords-phone.png`, `slip-group.png`, `slip-group-narrow.png`.

| Part | Result |
| --- | --- |
| Projection | `core/src/lunarMap.ts`: the LOLA map's own south polar stereographic (lat_0 = lat_ts = −90, lon_0 = 0, R = 1,737,400 m), forward and inverse, stepping from the target along the local east and north map vectors exactly as `tools/terrain/grid.py` does. Tested against `core/src/fixtures/lola-offsets.json`, written by `tools/terrain/miss_coords.py` with pyproj: every offset agrees to 1e-9°, round-trips to under 1 mm, and the target returns −84.78, 29.13. The Miss aim site in the site list now uses it too (it was a flat approximation). |
| Aim readout | "Aim: 84.7839 S, 29.1445 E (40 m east, 120 m south of the target)" in the panel, in the safer-place sentence and in the spoken announcement. Degrees, four decimals, N/S, east longitude 0–360. COPY copies "-84.7839, 29.1445" (signed latitude, east longitude), ready to paste into a coordinates field. |
| Pointer | Mouse: "POINTER: …" under the map while hovering. Touch: a tap shows a dashed marker and "TAPPED: …" with MOVE AIM HERE and CANCEL; the aim moves only on Move. The readout is a polite live region. |
| Go to coordinates | Latitude and longitude fields, labelled with their ranges; bad values show the same messages as Add coordinates above the field and focus moves to it. Within 400 m of the target the aim moves there (snapped to the 40 m grid and kept within 300 m, as before; it says so if that moves it more than 5 m) and the odds update. Further away it says terrain is prepared only around the IM-2 target and offers CHECK THIS POINT ON THE CONSOLE, which adds a custom site (smooth model) through the same `addCustomSite` as Add coordinates and opens the Console on it. |
| Save this aim as a site | Adds the aim point as a custom site named "IM-2 aim, 40 m east, 120 m south" at four decimals; it then works on the Console, Compare and Watch like any custom site (smooth model, no terrain). |
| Slip group | SLIP and its "?" are now the first cell inside the bordered step group, the same height as the steps, on wide screens and in the 600–899 px More grid. On phones the steps live in the date sheet, so there is no separate group. |

## Phone redesign (on staging, not deployed)

Built from "Moon Status: phone redesign": direction B as the Console front
screen, direction A's card as the site detail. Only under 600 px; desktop and
the 600–899 px stacked layout are unchanged. Screenshots: `docs/screens/phone-*.png`.

| Part | Result |
| --- | --- |
| Date bar | One line: date, hour, Now. Tapping the date opens a sheet (modal, focus trapped, Escape and Close return focus) with the date field and calendar, the seven step buttons, and Slip: ready or not at the landing hour on each of the next 14 days for the chosen site, from `/v1/slip`, with a slip-proof line; tapping a day moves the landing there. |
| Board | Chips All, Ready, No power, No link, Dark with counts (toggle buttons, state at landing). Board / Map switch is a tab list (arrow keys, Home, End). Two-column tiles grouped South pole, Apollo, Other landers: full name, symbol and word, and a strip lit where the Sun and Earth are both up over 30 days; ready tiles tinted. The incident list and Add coordinates follow. |
| Map | Polar view full width; markers show the state symbol; the chips filter it; "N sites are north of this map" with a button to the board. |
| Site card | Big status with a one-sentence reason (heights against the allowance or terrain), Sun and Earth, next change with what follows ("THEN READY"), the 30-day sun and Earth strip, then Map (zoomed in with the site at the centre), Timeline (play and scrub), Sky, All sites (the soonest change anywhere), Download, and the source link. ‹ › step through the filtered sites. Back returns to the board at the same scroll position with focus on the tile of the site shown. |
| Watch | One card per change with a + calendar button (spoken as "Add Sunrise, date, to your calendar"); Remind and Add all; email sign-up in a section that opens. |
| Compare | Setup chips (+10 DAYS, +12 HOURS, TWO SITES, MY AIM, each speaking the full name); the verdict is pinned at the top with two lines and "+ N more lines"; A and B are two tabs showing date and state. |
| Miss | When the Console's state for the target and the terrain verdict at the target disagree, a note says why: smooth Moon at that one hour against terrain at touchdown and 90% of the first 10 days. "This is the safest place to aim" only appears after Move to the safest spot. The AIM label never covers ORIGINAL TARGET. |
| Sky view | Sun and Earth labels keep clear of the "ALLOWANCE" (or "TERRAIN HORIZON") label; if they cannot, that label moves to the left end of its line. |
| Also | The tour points at the phone parts on a phone. Fixed missing spaces in Compare's "needs an aim" line on every width. |

## What changed

| Step | Result |
| --- | --- |
| A | "Now" sets the landing date and hour to the current UTC hour, in the scenario bar (Console, Miss and every tab) and on both Compare sides. The 2025 IM-2 case is still the opening default. The deploy seed now also seeds the 60 days from today and Apollo 11's landing day; it asks NASA only for hours not saved, so running it twice is safe (checked: second run made no requests). |
| B | Every dropdown and date field: browser arrow removed, our square chevron or calendar icon 12 px from the right, centred, muted colour, 36 px right padding. Place capped at 420 px, date and hour at 220 px. |
| C | Landing date and hour are real fields in the scenario bar with Now, the allowed range as a hint, and the range in the error message. |
| D | The polar map fills its pane as the largest centred square. The Sun and Earth labels in the sky view no longer overlap (tested layout function). |
| E | Tab icon is the header's Moon mark: SVG, plus `.ico`, PNG, apple-touch-icon and a web manifest. |
| G | Allowed dates 1960-01-01 to 2100-12-31 everywhere (validation, hints, errors, API page, connector, tests, PRD row, AGENTS.md). New: each visitor may open 12 dates an hour that are not saved yet (`NEW_PERIODS_PER_HOUR`); saved dates are never counted, and one date counts once across all sites. |
| 1 | Add coordinates finished: inline form in the site list, each site loads on its own, a new one shows "fetching" then loads real positions. Also fixed a bug: custom ids contain a comma and were split in half, so they never loaded. |
| 2 | Phone layout: tabs in a bar pinned to the bottom, one-line header, compact scenario bar, no sideways scrolling at 320 and 390 px. |
| F | Help button on every tab (side panel: what it answers, three steps, what each number means), a "?" with a one-sentence definition beside margin, accuracy, power up, link up, slip and miss, and a four-step first-visit tour on the Console with Skip and "Don't show again", restartable from Help. Escape closes, focus returns, no motion under reduced motion. |
| 8 | Watch without email: the next 30 days of sunrises, sunsets, Earth rises and Earth sets, each with Add to calendar (an `.ics` with a reminder), plus Add all, from new `GET /v1/windows.ics` (6-2). The placeholder text is gone everywhere. |
| 9 | Watch by email as the PRD defines it: sign-up, 24-hour confirmation link, four rules on the one calculator, re-check on scenario change and daily, one alert per break, unsubscribe (opening the link shows a Stop alerts page; the button or a mail app's one-click unsubscribe deletes the address; tested both ways, live and by test), limits, masked logs, privacy line above Start, delete with a Keep it dialog. Sends through Resend from `Moon Status <moon@okoro.me>`. **Off unless both `EMAIL_SENDING_KEY` and `TOKEN_SIGNING_SECRET` are set**; the deploy workflow's `.env` step and compose now pass both. Tested with a fake sender only; no real email was sent. |
| 3 | "How we know it's right": a panel on the API tab (linked from Help and the status bar) and the README section. Apollo 11: our Sun height at 1969-07-20 20:17 UTC is **10.7°**; NASA SP-2000-4029 gives **10.8°** (with the caution that the book also lists 10.8° as the planned angle). |
| 4 | README and CREDITS complete, including the exact LOLA product page and citation (PGDA product 90, Barker et al. 2023), Resend, and a "Use of AI tools" section. |
| 5 | Desktop screenshots of all five tabs. |
| 6 | Acceptance run: [docs/acceptance.md](docs/acceptance.md). |
| 7 | Incident list (1-12) on the Console: next changes across all sites, soonest first. |

## Verified by automated test

- 287 tests pass: 57 core, 140 server, 90 client (`npm test`), plus typecheck,
  lint and build. Phone redesign tests: filter counts and matching, card
  stepping, the reason sentence for every state and the terrain wording, ready
  strips, the soonest change across sites, time labels, sky labels clear of the
  allowance label, AIM clear of ORIGINAL TARGET across a 400 m square, the Miss
  difference note, and every phone tour step's target existing.
- Phone, by script at 320 and 390 px: axe clean and no sideways scroll on board,
  Ready filter, map, card, card with Map, Timeline and Sky open, date sheet,
  Watch, Watch email, Compare A and B, Miss and API; every control at least
  44 px except one link inside a sentence on the API tab (allowed). Keyboard:
  tab-list arrows and Home, chips with Enter and Space, a tile opens the card
  with focus on the name, ‹ › then Back returns focus to the right tile at the
  same scroll, the sheet traps Tab and Escape returns focus to the date. New tests this session cover: Now uses UTC; seed spans;
  sky label layout never overlaps; the 1960–2100 range at every endpoint;
  the new-period limit (counted once per date, saved dates free, applies to sky,
  slip and report); upcoming changes and the calendar file (escaping, folding,
  reminders, one change or all); the incident list (first entry equals the
  earliest next change); and all of Watch by email (off by default; nothing sent
  while waiting; confirm once; expired and altered links refused; resend; one
  alert per break with the same sentence as the log; daily check; delete needs
  the private link; unsubscribe deletes; per-visitor, per-address and daily
  limits; purge after the event; the Resend request shape against a fake fetch;
  no full address in any log; `slip14` agrees with `/v1/slip`; `odds70` with
  `/v1/miss`).
- `gitleaks` over the whole history: no leaks. History: dan-od only, no
  attribution lines.
- axe-core: no violations on any of the five tabs. No sideways scrolling on any
  tab at 320 px or at 200% zoom.

## Verified by hand

- Now, the date error ("The date must be from 1960-01-01 to 2100-12-31 (UTC)"),
  and the custom chevron and calendar icon in Chrome and WebKit (Safari's
  engine), with measured widths and padding.
- Polar map size and centring at 1440, 1680, 1920 and 390 px in Chromium 131,
  current Chrome and WebKit.
- Favicon files all served with the right types.
- Add coordinates: 95 refused with focus back on latitude; a real point
  (−85.5, 31.2) showed "fetching", then loaded (Sun +2.3°); Escape closes and
  returns focus.
- Phone layout at 390 px on all tabs. Phone redesign screenshots at 390 and
  320 px compared against the mockups; desktop Console checked unchanged.
- Help on Console and Compare, the tour's four steps, "Don't show again"
  remembered, the term hint opening and closing with Escape.
- Watch: four changes for the 2025 case (sunrise T+7 h, as the Console says);
  a single and an all-changes calendar file downloaded with the right headers.
- Watch by email, locally with the development sender: off state hides the form;
  sign-up, the confirmation link, first check holding (Sun 2.4° above 2.0°),
  margin 3° trips once, 3.5° sends nothing more, back to 2° logs "Rule holds
  again"; delete through the dialog leaves 0 watch and 0 event rows.
- The forced loading, unavailable and empty states after the loading rewrite.
- Every API endpoint from the command line, including the error replies;
  production `/`, `/v1/sites` and `/miss` answer 200 without sign-in.
- Apollo 11 numbers from `/v1/sky` at 20:00 and 21:00.

## Not verified (and why)

- **Real email.** Never sent, by your rule. You test at 4 (commands below).
- **Firefox.** Playwright's Firefox would not start headless on this Mac
  (sandbox error) and failed twice, so it was skipped, per your rules. Chrome and
  WebKit were checked.
- **A staging deployment.** None exists: `moon-dev.okoro.me` does not resolve and
  the workflow deploys only `main`. The acceptance run used the `staging` code on
  the full local stack. Setting up staging needs DNS and host changes.
- **Calendar import** into a calendar app (it would change your calendar), and
  opening the spreadsheet file in a spreadsheet app.
- **The phone redesign on a real phone** and with VoiceOver or TalkBack: checked
  only in Chromium's phone emulation (touch on, 320 and 390 px).
- **A screen-reader run** (A-7, A-8), the preview card in a chat app (E-2), a
  question through a real assistant (8-1).
- **The daily timer wrapper** (`startScheduler`) has no test; the daily check it
  runs does.

## Commands you must run

### To test Watch by email at 4

Production still runs `main`, which has none of today's work. Either:

**A. Deploy staging to production** (your decision; a push to `main` deploys).
The deploy now migrates the watch tables and seeds about 22 more NASA spans
(roughly 20 seconds). Check that the repository secrets `EMAIL_SENDING_KEY` and
`TOKEN_SIGNING_SECRET` exist first.

```bash
git checkout main
```

```bash
git merge --ff-only staging
```

```bash
git push origin main
```

Then open https://moon.okoro.me/watch, start a watch with your address, and
open the confirmation link from the email.

**B. Or test locally with the real key**, without touching production. Add
three lines to `server/.env` (git-ignored): `EMAIL_SENDING_KEY=<your Resend
key>`, `TOKEN_SIGNING_SECRET=<long random text>`, and
`PUBLIC_SITE_URL=http://localhost:5173`, then:

```bash
cd /Users/ds/Codes/nasa/server && npx tsx --env-file=.env src/db/migrate.ts
```

```bash
cd /Users/ds/Codes/nasa && npm run dev:server
```

```bash
cd /Users/ds/Codes/nasa && npm run dev:client
```

Open http://localhost:5173/watch. The local dev database is already migrated.

### Optional clean-up on this Mac

The Watch helper worked in a git worktree; its work is already on `staging`.

```bash
cd /Users/ds/Codes/nasa && git worktree remove .claude/worktrees/agent-afa91c84e595f2174 && git branch -D worktree-agent-afa91c84e595f2174
```

Playwright's browsers (915 MB, used only for checks, not a project dependency):

```bash
rm -rf ~/Library/Caches/ms-playwright
```

## Decisions for you

1. **Merge to `main`?** Everything above is on `staging` only.
2. **The opening case still reads "no power"** at 00:00 UTC (Sun 1.7°, under
   the 2° allowance). Unchanged.
3. **"Use of AI tools" in the README** names Claude through Claude Code and says
   the PRD and prototype were drafted with an AI assistant in chat. Please check
   it against your own records before submitting.
4. **Watch by email details** worth knowing:
   - The "3 confirmation emails per address per day" cap is held in memory and
     resets when the server restarts.
   - Watch data is deleted after 2026-12-15 (`WATCH_DATA_DELETE_AFTER`).
5. **Explain mode (1-10), status badge (6-3) and web alert addresses (5-7)**
   were not built. Help and the term hints cover most of what explain mode
   would.
6. **Brand kit files** (Space Apps logo, orbit pattern) are still not in the
   repository, so neither is shown. The README now says so instead of claiming
   the logo is used.
