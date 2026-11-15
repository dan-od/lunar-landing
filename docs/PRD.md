# Moon Status: flow by flow

Nov 14, 2026 · @DS

## Summary

Moon Status breaks into eight flows on one shared foundation, and four of them (check a site, compare, miss tolerance, watch) are the submission. Each flow is one person or program pursuing one goal; screens, server and data are layers inside a flow, not flows of their own.

- **Product:** a web app for the 2026 NASA Space Apps challenge "Lunar Landing Site Navigator". It answers whether a lander at a given place and time has sunlight for power and a line of sight to Earth.
- **Builder:** one person, 14 to 15 November 2026.
- **Depth and risk:** Deep. The flows share state, call an outside service with strict usage rules, store data, and send messages to addresses users type in.
- **Review level:** self-reviewed, lower assurance. No second reviewer has checked this.
- **Design status:** the canvas and the flow prototype have been reviewed screen by screen in chat. Explicit approval of the prototype is still needed before production screens are built.
- **Nothing is built.** Every proof gate is unverified until the build runs.

## Problem, users and goals

Mission planners re-check landing sites every time a launch date moves, using tools that are accurate but slow to read, and none of those tools warns them when a change turns a good site bad.

**The evidence.** NASA's challenge statement says existing tools (Quickmap, Moon Trek, Horizons) have complicated interfaces, and that hardware delays and launch slips force planners to reconsider dates and sites. In March 2025 the IM-2 lander came down about 250 m from its target inside a crater, got no sunlight on its panels, and its mission ended in about 13 hours.

| User | What they need | How Moon Status serves them |
| --- | --- | --- |
| Mission planner (primary) | A fast answer when a date or site changes, in a form they can pass to another team | Status words, change report, alerts, files, API |
| Educator | A way to show why the Moon's south pole is hard | Explain mode, the 2025 case, time scrubbing |
| Member of the public | To understand a landing in the news | Plain status words and the Miss map |
| Developer or AI assistant | The same answers by program | API and assistant connector |

**Goals**

1. A first-time visitor can tell whether a site works on a date within 10 seconds of the page loading.
2. Comparing two cases and getting a written report takes under a minute.
3. A planner can see how the odds change if the lander misses by 100, 250 or 320 m, and find a safer aim.
4. A planner is told, without opening the app, when a schedule change breaks a site.
5. Every number on screen is also reachable by API.

**Not goals**

- Matching the terrain accuracy, 3D views or validation depth of other entries.
- Radio link quality, ground station scheduling, thermal or battery modelling.
- Accounts, teams or saved workspaces.
- Sites outside the area covered by the south pole elevation map, for the Miss view.

**How success is judged this weekend**

- All Must items in the build order are deployed and pass their checks.
- The 2025 case runs end to end in the demo: site flagged, safer aim found, alert received.
- Sun and Earth heights match NASA's own output for a spot check at three times.

## What NASA asks for, and where it lives

Every objective in the challenge statement maps to a screen; real terrain is the only one covered in part.

| Objective in the statement | Where | State |
| --- | --- | --- |
| Site selection and comparison, curated list and custom coordinates | Console list and map, Add coordinates, Compare | Covered |
| Date and time flexibility | Slip buttons, Compare date and hour pickers | Covered |
| Sun and Earth positions relative to the horizon, time before sunset or Earthset | Inspector readouts, next change, sky strip | Covered |
| Power and communication assessment | Power and contact timeline, uptime, longest gap | Covered |
| Multiple visualization approaches | Pole map, timeline, sky strip, terrain map, tables | Covered |
| Temporal dynamics, animation or timeline | Time slider and play | Covered |
| Accessibility across skill levels | Explain mode for the public; files and API for planners | Covered |
| Why small location or date changes matter (optional) | Miss view, change report | Covered |
| Real topography (optional) | Miss view for one site; shadow allowance elsewhere | Partly |
| Earth's wobble and orbital variation (optional) | Included automatically, since positions come from NASA's calculator | Covered |

Resources named by NASA for this challenge: Quickmap, Moon Trek and the JPL Horizons System. The official judging criteria are not in the material I have seen and need checking on the Space Apps site.

## Where other entries stop

Seven public entries were read in full on 13 November; the four gaps below are what this product is built around.

| Capability | Entries that have it (of 7) |
| --- | --- |
| Real terrain horizons | 6 |
| Spreadsheet export | 4 |
| Share links | 2 fully, 1 partly |
| Calendar export | 1 |
| Launch-slip analysis | 1 |
| Hosted public API | 0 (one had a local-only endpoint; a later search found one backend service) |
| Alerts or notifications | 0 |
| AI assistant connector | 0 |
| Landing-miss analysis | 0 |

1. **What if we miss?** Flow 4.
2. **Watch and alert.** Flow 5.
3. **Hosted API and assistant connector.** Flows 7 and 8.
4. **Plain-language change report.** Flow 3.

More entries exist than were read, so these gaps are likely but not certain. Entries read: [Lunar Horizon Wheel](https://github.com/NetRunnerXD/lunar-horizon-wheel), [AS75 Lab](https://github.com/Anhad75/Space-Lab), [LightPath](https://github.com/AnmolGarg8/LightPath), [LunaHorizon](https://github.com/samuelakosaonyejekwe/lunahorizon), [CLPS Moon Browser](https://github.com/localizedprojects/CLPS-MOON-BROWSER), [Lunar Horizon](https://github.com/Abrar5510/lunar-horizon), [LuminaLuna](https://github.com/Planet-Coders/lunar-landing-site-navigator).

## Shared scenario and shared foundation

Every flow reads one scenario, and it lives in the page address so tabs, links and exports all agree.

| Field | Meaning | Default | Set by |
| --- | --- | --- | --- |
| Place | A site from the list, custom coordinates, or an aim point from the Miss tab | IM-2 target | Site list, map pin, add form, Miss hand-off |
| Landing date and hour (UTC) | The moment of touchdown | 2025-03-06 00:00 | Slip buttons, Compare pickers |
| Shadow allowance (degrees) | How far above the horizon the Sun or Earth must be to count | 2.0 | Settings |
| Landing accuracy (metres) | How far the lander could miss | 250 | Settings |
| Aim offset (metres east, north) | Where the aim sits relative to the original target | 0, 0 | Miss tab |

The shared foundation is built once and owned by no single flow:

1. **Position engine.** Asks NASA's Horizons service for the Sun's and Earth's height and direction from a point on the Moon, hourly, for a 60-day span. Tested live on 14 November: it accepts a surface point on the Moon and returned 721 hourly rows in one request.
2. **Request queue and cache.** One request to NASA at a time, every answer saved, saved answers reused. This is required by NASA's fair-use policy, and calls must come from the server, never the browser.
3. **Window calculator.** Turns positions into power and contact windows, uptime, longest gap and next change, given the shadow allowance.
4. **Site list.** Five to eight curated sites with coordinates and a source for each, plus custom sites.
5. **Terrain store.** Horizon profiles computed from NASA's 181 MB south pole elevation map (80 m per pixel), prepared in advance for one demo site.
6. **Error language.** Four states used everywhere: loading, service unavailable with saved results, no terrain for this site, and invalid input.
7. **Rate limiting and logging.** Per-visitor limits on every endpoint; logs never contain email addresses or alert addresses in full.

## Definitions and conventions

These fix the meanings the calculations depend on, so two parts of the app cannot disagree.

| Term | Definition | Status |
| --- | --- | --- |
| A landing works | The Sun and Earth are both above the horizon (terrain where prepared, shadow allowance otherwise) at touchdown and for at least 90% of the first 10 days | Assumed. Ten days was the planned surface mission of the 2025 lander |
| Ready | Works at the landing moment: Sun and Earth both above the allowance | Locked |
| No power, no link, dark | Sun below, Earth below, or both below, at the moment shown | Locked |
| Shadow allowance | Minimum height above a flat horizon for the Sun or Earth to count. Default 2.0 degrees, range 0 to 5 | Locked |
| Sun and Earth position | The centre of the body, as NASA reports it. Disc size is not modelled | Locked |
| Site height | 0 km above the reference surface unless terrain is prepared for the site | Assumed |
| Direction | Degrees clockwise from north, 0 to 360, for both NASA positions and terrain profiles | Must be verified |
| Time | UTC everywhere, hourly positions, 12-hour cells on timelines | Locked |
| Allowed dates | 1960-01-01 to 2100-12-31; anything else is refused with the range | Owner decision, 2026-11-15 (was 2020 to 2040) |
| Window | An unbroken stretch where a condition holds, with start, end and length | Locked |
| Slip | A whole number of days added to the landing date, from minus 30 to plus 30 | Locked |

- **Direction check, required before Miss is trusted:** pick one hour, read the Sun's direction from NASA, and confirm the terrain profile's index for that direction points the same way on a map. A mismatch gives shadows that look plausible and are wrong.
- **Which design decides what:** the flow prototype decides behaviour, states and wording; the design canvas decides appearance. Where they differ, the prototype wins.

## Site list

Five sites ship in the starter list, each with a cited coordinate source (F-5). Longitudes are degrees east, as NASA Horizons expects. Latitude is negative for south in the code.

| Site | Latitude | Longitude (east) | Terrain prepared | Source |
| --- | --- | --- | --- | --- |
| IM-2 target, Mons Mouton | 84.78 S | 29.13 | Yes (demo site) | [LROC, IM-2 landing region](https://www.lroc.asu.edu/images/1401) |
| IM-1 Odysseus, near Malapert A | 80.13 S | 1.44 | No | [NASA](https://www.nasa.gov/?p=620655) (elevation 2,579 m) |
| Shackleton–de Gerlache ridge (rim intersection) | 89.684 S | 196.739 | No | [LROC](https://www.lroc.asu.edu/images/1247) |
| Chandrayaan-3, Statio Shiv Shakti | 69.373 S | 32.319 | No | [IAU-approved site](https://en.wikipedia.org/wiki/Statio_Shiv_Shakti) |
| Apollo 11 lunar module | 0.67416 N | 23.47314 | No | [NASA NSSDC](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html) |

Re-check note (IM-2): the LROC image page at the cited URL now redirects to an interactive OpenLayers map viewer (`lroc.im-ldi.com`) that carries no coordinates as static text, so the digits could not be re-read programmatically. The owner-specified values (84.78 S, 29.13 E) are used; correct them if an interactive read of the viewer differs.

The actual 2025 touchdown point (about 250 m from the target) still needs a sourced position before it is drawn on the Miss map.

## Design rules

The app looks like a desktop console in the Space Apps brand: square panes divided by thin lines, no rounded cards, no page-style hero sections.

| Token | Value | Use |
| --- | --- | --- |
| Deep Blue | #07173F | Page background |
| Pane | #050F2C | Side panes, header, status bar |
| Electric Blue | #0042A6 | Selected rows, gradient start |
| Blue Yonder | #2E96F5 | Earth, contact bars, pane edges |
| Neon Yellow | #EAFE07 | Sun, power bars, primary buttons, active tab. Accent only |
| Rocket Red | #E43700 | Border on not-ready tags. Never a background |
| White | #FFFFFF | Text |
| Muted | #B9C6E4 | Secondary text and labels |
| Line | #23408A | Dividers |
| Off | #1B2F66 | Outage cells |

- **Gradient:** Electric Blue to Deep Blue at 135 degrees, behind the two map panes only.
- **Type:** Fira Sans Black, capitals, for headings; Overpass for body and controls; Fira Code for readouts, coordinates and pane labels.
- **Shape:** corner radius 0 everywhere. Circles only for the Moon, the terrain view, the Sun and Earth, and rings.
- **Layout:** header 52 px, scenario bar, three panes (list about 250 px, main flexible, inspector about 310 px), status bar. Below 900 px the panes stack and the tabs move to a bar pinned to the bottom.
- **Controls:** every button at least 44 px tall. Primary action is yellow with dark text; secondary is outlined.
- **Status is never colour alone:** each state has a symbol and a word (ready, no power, no link, dark).
- **Containers:** pages for the five tabs; an inline form for Add coordinates; a right drawer for Settings; a small dialog only for deleting a watch; a short message at the bottom for confirmations.
- **Motion:** drawer slides in 180 ms; the time marker steps every 120 ms while playing. With reduced motion on, nothing slides and the marker jumps in 5-day steps.
- **Keyboard:** every action reachable by Tab; Escape closes the drawer, dialog and form; focus returns to the control that opened them. The terrain map has arrow buttons as its keyboard equivalent.
- **Brand rules from the Space Apps guide:** only the Space Apps logo, unaltered, in the footer; no NASA insignia; text only on Deep Blue, Electric Blue or white.
- **Phone feedback (vibration):** none on the web build. If a phone build follows: a light tap on selection, a warning on a rejected form, a success pulse when a watch is confirmed. Untested.

## Architecture and data

A single-page front end talks to one server, which owns the cache, the calculator and all contact with NASA; the browser never calls NASA directly.

| Part | Choice | Notes |
| --- | --- | --- |
| Front end | React, TypeScript, Vite | Scenario kept in the page address |
| Server | Node, Express | Serves the API and the built front end |
| Database | PostgreSQL | Cache, sites, watches, events |
| Terrain preparation | Python script, run once before the demo | Reads the elevation map, writes horizon profiles |
| Assistant connector | Small server over the API | Read-only tools |
| Email | Existing sending account | Confirmation and alert messages |
| Hosting | Homelab, own compose stack behind the shared proxy, deployed by the existing pipeline | Staging first, then production |

Data the server keeps:

| Table | Holds | Key fields |
| --- | --- | --- |
| sites | Curated and custom sites | id, name, latitude, longitude, source, owner session (custom only), has\_terrain |
| position\_cache | NASA replies, one row per site, body and hour | site id, body (Sun or Earth), time, direction, height, fetched at |
| horizon\_profiles | Terrain horizon for a point | site id, offset east, offset north, 360 heights |
| watches | Alert requests | id, site id, scenario, rule, address, status, token hash, token expiry, manage-link hash |
| events | Watch log | watch id, time, level, message |

How positions are fetched (tested 14 November):

- Address: the Horizons API at ssd.jpl.nasa.gov.
- Body: 10 for the Sun, 399 for Earth.
- Viewpoint: the setting `coord@301` (a point on the Moon) with coordinates given as east longitude, latitude and height in kilometres.
- Output: direction and height above the horizon (quantity 4), hourly.
- One request returned 721 rows for 30 days. A step of "12h" was honoured; "3d" was ignored, so follow the spacing in NASA's documentation.
- Rules: one request at a time, results cached and reused, no calls from the browser.

How terrain is prepared:

1. Download the south pole elevation map (LDEM\_80S\_80MPP\_ADJ.TIF, 181 MB, 80 m per pixel) from NASA Goddard's archive.
2. For each point on a grid around the target, look outward in 360 directions and record the highest terrain angle in each.
3. Save those 360 values as the point's horizon profile.
4. A point works at a given time if the Sun and Earth are above the profile in their direction.

Settings the deployment needs, by name only: database address, email sending key, public site address, token signing secret, rate-limit values. No values are stored in the repository.

## API in detail

Every reply names the scenario and model used, and every error names the field at fault.

| Endpoint | Inputs | Reply |
| --- | --- | --- |
| GET /v1/sites | none | List of id, name, latitude, longitude, source, has\_terrain |
| GET /v1/sky | site or lat and lon; time | Sun and Earth direction and height; state word |
| GET /v1/windows | site or lat and lon; start; days (up to 60); margin | Power and contact windows; uptime; longest gap; next change |
| GET /v1/report | a and b, each a site, date and hour | Verdict and sentences, each marked better, worse or same |
| GET /v1/miss | site; aim east and north; accuracy | Share of working points; safest aim nearby |
| POST /v1/watches | site, scenario, rule, address | Watch id with status pending |
| GET /v1/windows.csv, /v1/windows.ics | as windows | File |
| GET /badge/{site}.svg | date | Small status image |

| Error | When | What the caller gets |
| --- | --- | --- |
| 400 | A value is missing or out of range | The field name and the allowed range |
| 404 | Unknown site | A message naming the id |
| 409 | No terrain for this site (Miss only) | A message saying which sites have terrain |
| 429 | Too many requests | Seconds to wait |
| 503 | NASA unavailable and nothing saved | A message; saved results are returned with a "saved" flag when they exist |

## Flow map

Eight flows, each with one actor and one measurable goal. Flows 1 to 5 belong to a person using the app; 6 to 8 belong to someone taking results elsewhere.

| # | Flow | Actor | Goal | Starts when | Done when | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Check a site | Mission planner, educator or member of the public | Know whether a place has power and Earth contact on a date | They open the app or a shared link | They can read ready or not ready, the 30-day timeline and the next change | Foundation |
| 2 | Add coordinates | Mission planner | Evaluate a place not in the list | They press Add coordinates | The new site appears in the list with real positions | Foundation, flow 1 |
| 3 | Compare two cases | Mission planner | Decide between two places, dates or hours | They open Compare or press a quick setup | They hold a plain-language change report | Flow 1 |
| 4 | Test a missed landing | Mission planner | Know how risky a site is if the lander lands off target, and find a safer aim | They open Miss on a site with terrain | They see landings that would work out of 10 and have kept or moved the aim | Foundation (terrain), flow 1 |
| 5 | Watch and be alerted | Mission planner | Be told when a change makes a site stop working | They start a watch | The watch is confirmed and an alert arrives when its rule breaks | Flows 1, 3, 4 |
| 6 | Take results out | Mission planner | Use the results in a spreadsheet, calendar or message | They press an export or copy a link | The file or link matches what was on screen | Flows 1, 3 |
| 7 | Call the API | Developer or another tool | Get the same answers by program | They send a request | They receive a correct reply or a clear error | Foundation |
| 8 | Ask through an assistant | Person using an AI assistant | Ask a question in words and get the app's numbers | The assistant calls a connector tool | The assistant answers from the app's data | Flow 7 |

Sign-in is not a flow: there are no accounts. First open, settings, explain mode and time scrubbing are steps inside flow 1.

## Flows 1 to 4 in detail

### Flow 1: Check a site

The Console is one page with three panes, so the site list, map and readouts stay visible together.

1. **First open.** Two choices on the page itself: start with the 2025 landing, or choose a site. A shared link skips this and loads its scenario.
2. **Pick a place.** From the list or a map pin. The selected site is highlighted in list, map and timeline.
3. **Read the state.** A word and a symbol (ready, no power, no link, dark), Sun and Earth height, share of time with sunlight and with contact, next sunset or sunrise.
4. **Move through time.** Drag the slider or press play; a white line moves along the 30-day timeline and the readouts follow it.
5. **Slip the date.** The minus 1, plus 1 and plus 10 day buttons change the landing date for every tab.
6. **Adjust.** Settings opens as a side drawer with shadow allowance and landing accuracy. Explain swaps shorthand for plain words.
7. **Leave.** To Compare, Miss or Watch, carrying the scenario.

| State | What the person sees |
| --- | --- |
| Loading | Grey placeholder bars and "asking NASA for positions" |
| Service unavailable | A banner, results saved earlier, Add coordinates disabled, Retry that stops after three tries |
| Empty list | "No sites yet" with Load starter list and Add coordinates |
| Phone width | Panes stack; tabs become a bar pinned to the bottom |

Server work: read saved positions for the place and span, compute windows, return them. Nothing is written.

### Flow 2: Add coordinates

An inline form in the site list, so existing sites stay visible while typing.

1. Press Add coordinates. Focus moves to latitude.
2. Enter a name (optional), latitude from minus 90 to 90, longitude from minus 180 to 360.
3. Press Add site. Bad values show a message above the field and focus returns to it.
4. The site appears marked "fetching" while the server asks NASA for two series (Sun and Earth).
5. When positions arrive it becomes selectable like any other site.

- **Cancel:** the Cancel button or Escape closes the form and returns focus to the Add button.
- **Service unavailable:** the form is disabled with the reason shown.
- **Limit:** a visitor can add a small number of sites per hour, because each one costs two NASA requests.
- **Storage:** custom sites are saved with the visitor's browser session, not shared with others.

### Flow 3: Compare two cases

One page with two equal panes and a report. Each side has its own place, date and hour.

1. Open Compare, or arrive from Console or Miss with one side filled in.
2. Use a quick setup (same place 10 days later, same day 12 hours later, two sites, target against my aim) or set each side by hand.
3. Read the two sets of readouts and timelines.
4. Read the change report: one verdict and five plain sentences, each marked better, worse or the same.
5. Copy the report, or send the case to Watch.

- **No meaningful change** is a designed result, shown when every line is the same. The Moon turns slowly, so a few hours often changes nothing.
- **Copy failure** is reported plainly; the text stays on screen to select by hand.

Server work: two window calculations and a comparison. Nothing is written.

### Flow 4: Test a missed landing

One page: a round terrain map on the left, odds on the right.

1. Open Miss. The original target is the scenario's place.
2. See light ground (works) and dark ground (shadow), with three rings around the aim at 100, 250 and 320 metres.
3. Read three lines, one per lander accuracy: how many landings out of 10 would work.
4. Click the map, or use the arrow buttons, to move the aim. The rings and numbers follow.
5. Press Move to the safest spot, or Back to the target.
6. Use the aim elsewhere: see its next 30 days (Console), compare it with the target (Compare), or be alerted if it stops working (Watch).

- **No terrain for this site:** the page explains what is missing and offers two exits. This is expected for every site except the demo site.
- **How the odds are computed:** for a grid of points around the aim, each point gets its own terrain horizon; a point works if the Sun and Earth clear that horizon for the mission span. The odds are the share of working points inside the ring.
- **Hand-off:** carrying the aim creates a site named "IM-2 aim" in the list.

Server work: read the prepared terrain grid, compute odds for the aim. Nothing is written until the aim is carried.

## Flows 5 to 8 in detail

### Flow 5: Watch and be alerted

One page with three panes: watches, event log, new watch form. This is the only flow that stores personal data and sends anything out.

1. Choose a place, a rule, and where to send alerts (an email address or an https address).
2. Press Start watch. The address is checked before anything is saved.
3. The watch shows as waiting. An email owner gets a confirmation link; an https address gets a test message it must answer.
4. Once confirmed, the watch is active and its first check runs.
5. The rule is re-checked whenever the watched scenario's date, shadow allowance, accuracy or aim changes, and once a day.
6. If the rule breaks, the watch shows as tripped, the log records why in plain words, and one alert is sent. If it holds again, the log records that.
7. Delete asks for confirmation in a small dialog, with focus on Keep it.

| Rule | Breaks when |
| --- | --- |
| No power at landing | The Sun is below the shadow allowance at touchdown |
| Contact lost too long | The longest gap in Earth contact exceeds 3 days |
| Not slip-proof | The site is not ready at some slip from 0 to 14 days |
| Odds too low | Fewer than 7 in 10 landings would work at the chosen accuracy |

| State | What happens |
| --- | --- |
| Bad address | Message above the field; nothing saved |
| Waiting | No alerts until confirmed |
| Link expired (24 hours) | Watch shows expired; Send a new link is offered |
| Tripped | One alert per break, not one per check |
| Send failure | Logged; retried a limited number of times, then marked failed |

Server work: store the watch, a confirmation token and its expiry; a scheduled job for daily checks; an outbound sender for email and https messages.

### Flow 6: Take results out

Actions on existing pages, not a page of its own.

- **Share link:** always available, because the scenario is in the address.
- **Spreadsheet file:** one row per power or contact window, with start, end and length, plus the scenario in the header.
- **Calendar file:** the same windows as calendar entries.
- **Copy report:** the Compare sentences as text.
- **Status badge:** a small image showing a site's state for a date, for a wiki or README.

Every file states that it comes from a smooth-Moon model unless terrain was used.

### Flow 7: Call the API

The actor is a program. The pages themselves use these endpoints, so there is one source of answers.

| Endpoint | Returns |
| --- | --- |
| GET /v1/sites | Curated sites with coordinates and source |
| GET /v1/sky | Sun and Earth height at one place and time |
| GET /v1/windows | Power and contact windows over a span |
| GET /v1/report | Change report between two cases |
| GET /v1/miss | Odds of a working landing around an aim |
| POST /v1/watches | Starts a watch, pending confirmation |

- **Errors:** invalid input returns a clear message naming the field; too many requests returns a wait time; NASA unavailable returns saved results marked as saved, or an unavailable error if none exist.
- **Limits:** a small number of requests per minute per visitor; custom coordinates are limited further.
- **Stability:** version 1 only adds fields; nothing is removed or renamed during the event.

### Flow 8: Ask through an assistant

A thin connector over flow 7, so an AI assistant can answer questions such as "which sites survive a 10-day slip?".

- **Tools:** list\_sites, get\_windows, compare\_sites, slip\_impact, miss\_tolerance, change\_report.
- **Read-only:** the connector cannot start or delete watches.
- **Same limits** as the API.
- **Replies** carry the scenario and model used, so the assistant can state its assumptions.

## Requirements and acceptance checks

Each requirement has one check that decides whether it is done; the tier says whether it ships this weekend.

| ID | Requirement | Done when | Tier |
| --- | --- | --- | --- |
| F-1 | The server fetches Sun and Earth positions for a Moon surface point from NASA | A fetched row equals NASA's own output for the same point and hour | Must |
| F-2 | Only one request to NASA is in flight at any time | Ten simultaneous page loads produce sequential NASA calls | Must |
| F-3 | Every NASA reply is cached and reused | A second load of the same site makes no NASA call | Must |
| F-4 | Windows, uptime, longest gap and next change are computed from positions and the shadow allowance | Unit checks pass on a saved reply at allowances of 0, 2 and 5 degrees | Must |
| F-5 | The site list ships with at least five sites, each with a cited coordinate source | Each row shows its source | Must |
| 1-1 | First open offers the 2025 case or a site choice | A new visitor reaches a loaded site in one click | Must |
| 1-2 | Each site shows a state word and symbol for the landing moment | Colour-blind check: states are distinguishable without colour | Must |
| 1-3 | A 30-day power and contact timeline is shown for every site | Bars match the calculator's windows | Must |
| 1-4 | A time slider and play button move a marker; readouts follow | Readouts at day 12 equal the calculator at day 12 | Must |
| 1-5 | Slip buttons change the landing date for all tabs | After a slip, Compare, Miss and Watch show the new date | Must |
| 1-6 | The scenario is stored in the page address | Pasting the address in a new window restores the same view | Must |
| 1-7 | Loading, service-unavailable and empty states are shown as designed | Each can be forced in a test build | Must |
| 1-8 | Settings change the shadow allowance and landing accuracy | Changing the allowance changes the bars immediately | Must |
| 1-9 | Layout works at 390 px wide with tabs at the bottom | No sideways scrolling on a phone | Should |
| 1-10 | Explain mode replaces shorthand with plain words | Every readout label has a plain version | Could |
| 2-1 | A visitor can add a site by latitude and longitude | The site loads real positions and can be selected | Should |
| 2-2 | Out-of-range values are refused with a message at the field | 95 for latitude is refused; focus returns to the field | Should |
| 2-3 | Adding sites is limited per visitor per hour | The request over the limit is refused with a wait time | Should |
| 3-1 | Each side of Compare has its own place, date and hour | Any pairing can be set by hand | Must |
| 3-2 | Four quick setups fill both sides from the scenario | Each produces the expected pairing | Must |
| 3-3 | A change report gives a verdict and five sentences | Sentences match the numbers on each side | Must |
| 3-4 | Identical results show "No meaningful change" | Same place, same time on both sides shows it | Must |
| 3-5 | The report can be copied as text | Pasted text equals the on-screen sentences | Must |
| 4-1 | Horizon profiles exist for a grid of points around one demo site | The grid covers at least 320 m in every direction | Must |
| 4-2 | The map shades working and shadowed ground from those profiles | A known crater appears dark | Must |
| 4-3 | Clicking the map or using arrow buttons moves the aim and rings | The aim text and rings update together | Must |
| 4-4 | Three lines show landings that would work out of 10, at 100, 250 and 320 m | Each equals the share of working points inside its ring | Must |
| 4-5 | "Move to the safest spot" finds the best aim within 300 m | The result has odds at least as high as any other grid aim | Must |
| 4-6 | The aim can be carried to Console, Compare and Watch | Each destination opens with the aim in place | Must |
| 4-7 | Sites without terrain show an explanation and two exits | Opening Miss on another site shows it | Must |
| 5-1 | A watch is created with a place, rule and address | It appears as waiting | Should |
| 5-2 | No alert is sent until the address owner confirms | A broken rule on a waiting watch sends nothing | Should |
| 5-3 | Confirmation links expire after 24 hours and can be re-sent | An old link is refused; a new one works | Should |
| 5-4 | Rules are re-checked on scenario change and daily | A 10-day slip trips a "no power" watch once | Should |
| 5-5 | One alert is sent per break, with a plain-language reason and a link | The email matches the event log entry | Should |
| 5-6 | Deleting a watch needs its private link and a confirmation | Delete without the link is refused | Should |
| 5-7 | Web addresses for alerts are accepted only if public and https | Local and internal addresses are refused | Could |
| 6-1 | A spreadsheet file lists every window | Row count equals windows on screen | Must |
| 6-2 | A calendar file lists the same windows | It imports into a calendar app | Could |
| 6-3 | A status badge image is available per site and date | It shows the same state word as the Console | Could |
| 7-1 | Sites, sky and windows endpoints are public | Each returns a correct reply from the command line | Must |
| 7-2 | Report and miss endpoints are public | Replies match the Compare and Miss screens | Must |
| 7-3 | Every endpoint is rate limited | The request over the limit gets a wait time | Must |
| 7-4 | Errors name the field at fault | A bad latitude returns the allowed range | Must |
| 8-1 | Six read-only tools are offered to AI assistants | An assistant answers "which sites survive a 10-day slip?" with the app's numbers | Should |
| S-1 | No secrets in the repository | Secret scan passes | Must |
| S-2 | Addresses are masked in logs | A log search finds no full email address | Should |
| S-3 | Site names are escaped on screen and in files | A name beginning with an equals sign exports as text | Must |
| G-1 | Git history shows only dan-od, with no AI attribution | A search of the history finds no co-author or generated-by lines | Must |

## Requirements added in review

These fill the gaps found on re-reading: the sky view, slip analysis, the incident list, conventions, accessibility, search visibility, deployment and privacy.

| ID | Requirement | Done when | Tier |
| --- | --- | --- | --- |
| 1-11 | The inspector shows a sky view: the Sun and Earth drawn against a horizon line, with the shadow allowance marked, at the time shown by the marker | Positions in the picture match the height readouts at three times | Must |
| 1-12 | An incident list shows the next sunsets, sunrises, Earthsets and Earthrises across all sites, soonest first | The first entry equals the earliest next change in the site list | Should |
| 1-13 | Dates outside 1960 to 2100 are refused with the allowed range | A link with a 2150 date opens the default date and says why | Must |
| F-6 | Direction convention verified between NASA positions and terrain profiles | The check in Definitions is recorded with its result | Must (if Miss ships) |
| F-7 | "A landing works" uses the 10-day, 90% definition everywhere | Miss odds, the watch rule and the API return the same answer for one point | Must (if Miss ships) |
| 7-5 | GET /v1/slip returns ready or not ready for each slip day from minus 30 to plus 30 | The reply at slip 0 equals the Console state | Should |
| 7-6 | The "not slip-proof" watch rule and the slip\_impact assistant tool both read from /v1/slip | All three agree for one site | Should |
| A-1 | Every action works by keyboard alone, in a sensible order | A full run of flows 1, 3 and 4 with no mouse | Must |
| A-2 | Focus is always visible, and returns to the opening control when a drawer, dialog or form closes | Checked on each of the three | Must |
| A-3 | Text and controls meet contrast level AA | An automated contrast check reports no failures | Must |
| A-4 | State is never shown by colour alone | Greyscale screenshot remains readable | Must |
| A-5 | Reduced-motion setting is respected | With it on, nothing slides and play steps in jumps | Must |
| A-6 | Timelines and maps have text equivalents | A screen reader hears each site's sunlight and contact shares | Must |
| A-7 | Form errors are announced and tied to their field | A screen reader hears the error on submit | Should |
| A-8 | Status messages are announced without moving focus | "Watch is active" is heard after confirming | Should |
| A-9 | The page works at 200% zoom and at 320 px wide | No content is cut off or needs sideways scrolling | Should |
| E-1 | Each tab has its own address, title and description | Opening /miss directly shows the Miss tab with its own title | Must |
| E-2 | A link preview image and description appear when the address is shared | Pasting the address in a chat app shows a card | Should |
| E-3 | The page has useful content before scripts run | Viewing the page source shows a heading and a summary paragraph | Should |
| E-4 | The site provides a sitemap and a robots file | Both load from the root address | Could |
| D-1 | Production is public with no sign-in; staging stays behind a sign-in | A private browser window opens production | Must |
| D-2 | The app runs as its own isolated stack behind the shared proxy, with a health check | The health address answers; no ports are published | Must |
| D-3 | Production is added to the uptime monitor after launch | It appears on the status page | Could |
| P-1 | The watch form says what is stored and for how long | The line is visible above the Start button | Should |
| P-2 | Watch data is deleted when a watch is deleted, and all watch data is removed 30 days after the event | A deleted watch leaves no row | Should |
| L-1 | The repository has an open-source licence and a README naming data sources and limits | Both files exist at the root | Must |

## Contracts between flows

Every hand-off carries the scenario through the page address, and the receiving flow must work when opened cold from a link.

| From | To | Carries | Receiving side must |
| --- | --- | --- | --- |
| 1 Check a site | 3 Compare | Place, date, hour | Fill side A; offer quick setups for side B |
| 1 Check a site | 4 Miss | Place, date, accuracy | Show the map, or the no-terrain page |
| 1 Check a site | 5 Watch | Place, date | Pre-fill the form; save nothing until Start |
| 2 Add coordinates | 1 Check a site | New site id | Show it as fetching, then selectable |
| 4 Miss | 1 Check a site | Aim offset as a new site | List it as "IM-2 aim" with its own timeline |
| 4 Miss | 3 Compare | Target and aim | Side A is the target, side B the aim |
| 4 Miss | 5 Watch | Aim, accuracy | Pre-select the "odds too low" rule |
| 3 Compare | 5 Watch | Side B's case | Pre-fill the form |
| 1, 3 | 6 Take results out | Current scenario | Produce files that match the screen |
| Any change to date, allowance, accuracy or aim | 5 Watch | The changed scenario | Re-check each active watch once |
| 7 API | 8 Assistant | Same request and reply shapes | Add nothing the API does not return |

Three rules hold across all of them:

1. **One calculator.** Pages, files, API and connector all call the same window calculator, so numbers cannot disagree.
2. **Unknown values fall back, never fail.** A link naming a site that no longer exists opens the first site and says so.
3. **The model is always named.** Every reply and file says whether it used the smooth-Moon model or terrain.

## Security and abuse cases

The app has no accounts, so the risks sit in three places: addresses people type in, requests to NASA made on visitors' behalf, and the small amount of personal data in watches.

| Risk | Where | Control | How to prove it |
| --- | --- | --- | --- |
| Signing up someone else's email for alerts | Flow 5 | No alerts until the address owner confirms; link expires in 24 hours; one-click stop in every alert | Unconfirmed watch sends nothing when its rule breaks |
| Alert address pointed at an internal network | Flow 5 | https only; reject localhost, private and link-local ranges and raw numeric addresses; resolve the name on the server and re-check the resolved address; no redirects followed | Each rejected form returns the same clear error |
| Flooding NASA through our server | Flows 2, 7, 8 | One outbound request at a time; cache first; per-visitor limits; custom coordinates limited per hour | Ten parallel requests produce one NASA call at a time |
| Flooding our own server | Flows 7, 8 | Per-visitor request limit with a stated wait | The request over the limit gets a wait time |
| Guessing or tampering with confirmation links | Flow 5 | Long random single-use tokens, stored hashed, compared in constant time | A used or altered token is refused |
| Deleting someone else's watch | Flow 5 | Delete requires the private manage link sent to the confirmed address | Delete without it is refused |
| Hostile text in site names | Flows 2, 6 | Escape on output; length limit; spreadsheet cells never start a formula | A name starting with an equals sign exports as text |
| Leaking personal data | Flow 5 | Store only address, rule and scenario; mask addresses in logs; delete a watch's data when it is deleted | Logs show masked addresses only |
| Secrets in the repository | All | Keys come from deployment secrets; none committed | Secret scan passes |

Not applicable: payments, roles and permissions between users, and cross-tenant access, because there are no accounts or tenants.

## Build order, cut line and proof

The full scope is roughly 33 to 40 hours of work, which is more than one person has in a weekend, so the cut line below decides what ships.

| Order | Work | Rough hours | Tier |
| --- | --- | --- | --- |
| 1 | Foundation: position engine, queue and cache, window calculator, site list | 4 to 5 | Must |
| 2 | API: sites, sky, windows | 2 | Must |
| 3 | Flow 1: Console with timeline, scrubbing, slip, states | 6 to 8 | Must |
| 4 | Flow 6, part 1: share link and spreadsheet file | 1 | Must |
| 5 | Terrain preparation for one site, then Flow 4: Miss | 5 to 7 | Must |
| 6 | Flow 3: Compare and change report | 3 | Must |
| 7 | Submission: demo, write-up, project page | 3 | Must |
| 8 | Flow 5: Watch with email confirmation only | 4 to 5 | Should |
| 9 | Flow 8: assistant connector | 2 | Should |
| 10 | Flow 2: Add coordinates | 2 | Should |
| 11 | Calendar file, status badge, https alert addresses, explain mode, phone polish | 3 to 4 | Could |

- **Must total:** 24 to 29 hours. This is the submission.
- **If behind, cut from the bottom up.** Do not start a Should item while a Must item is unfinished.
- **Terrain checkpoint:** if the elevation map is not producing horizon profiles by Saturday evening, stop, drop Miss to a stated next step, and move Watch up into the Must tier. Do not ship invented terrain as if it were real.
- **Changed advice:** earlier in the planning I said never to cut exports or the connector. The competitor research showed exports are common, so the differentiators to protect are Miss, the change report and Watch.

Proof each flow needs before it counts as done:

| Flow | Automated check | Run-through by hand |
| --- | --- | --- |
| Foundation | Window calculator against a saved NASA reply; queue never sends two requests at once | Fetch one site live and compare one row with NASA's own page |
| 1 Check a site | Readouts match the calculator at three times | First open, scrub, slip, service-down banner, phone width |
| 2 Add coordinates | Rejects out-of-range values; per-hour limit holds | Add a real point and see it load |
| 3 Compare | Report sentences match the two sides; "no meaningful change" case | All four quick setups |
| 4 Miss | Odds for a known grid; no-terrain page for other sites | Move the aim, find safest spot, carry to each tab |
| 5 Watch | Unconfirmed watch never sends; bad addresses refused; expired link refused | Start, confirm by real email, slip the date, receive one alert |
| 6 Take results out | File rows equal on-screen windows | Open the file in a spreadsheet app |
| 7 API | Every endpoint: good request, bad request, over the limit | Call each from the command line |
| 8 Assistant | Each tool returns the API's values | Ask one question from an assistant |

## Accessibility pass

Run this once the Must screens exist, before the demo is recorded; the target is level AA of the Web Content Accessibility Guidelines.

- [ ] **Keyboard:** Tab reaches every control in reading order; Enter and Space activate; Escape closes the drawer, dialog and form
- [ ] **Skip link:** a "Skip to content" link is the first stop on every tab
- [ ] **Focus:** always visible against dark panes; returns to the opener on close; moves to the first field when a form opens
- [ ] **Structure:** one main heading per tab; header, navigation, main and footer regions marked; pane labels are headings
- [ ] **Names:** icon-only buttons (settings gear, arrows, play) have spoken names; the active tab and pressed buttons are announced as such
- [ ] **Forms:** every field has a visible label; errors are announced and linked to their field; nothing relies on placeholder text
- [ ] **Tables:** header cells are marked in the event log and the comparison table
- [ ] **Timelines:** each track has a spoken summary, and a "show as table" option lists the windows
- [ ] **Pole map:** the site list is its full equivalent; pins carry the site name and state
- [ ] **Terrain map:** arrow buttons move the aim; the aim position and odds are announced after each move
- [ ] **Colour:** contrast checked for every text and control pair; yellow is never placed on white; state always has a symbol and a word
- [ ] **Targets:** every control is at least 44 px in both directions
- [ ] **Motion:** the reduced-motion setting stops sliding and stepping animation; play can always be paused
- [ ] **Zoom and reflow:** usable at 200% zoom and at 320 px wide
- [ ] **Language:** the page language is set to English
- [ ] **Announcements:** confirmations and alerts are announced without stealing focus
- [ ] **Automated check:** an accessibility scanner reports no critical or serious issues on each tab
- [ ] **Screen reader run:** flows 1, 3 and 4 completed once with VoiceOver

What stays untested without real devices: phone screen readers and switch access.

## Search and sharing pass

The goal is that a judge, recruiter or search engine landing on any address sees what the app is before it loads, and that a shared link shows a proper preview.

- [ ] **Real addresses per tab:** /, /compare, /miss, /watch and /api, each loadable directly. The prototype used # addresses only because of where it is hosted
- [ ] **Scenario in the query:** place, date, hour, allowance, accuracy and aim after the question mark, with the canonical address pointing to the tab without them
- [ ] **Title and description per tab:** for example "Moon Status: will a lunar lander have power and a line to Earth?"
- [ ] **Content before scripts:** the page source holds a heading, a two-sentence summary and links to each tab
- [ ] **Preview card:** an image of 1200 by 630 pixels, title and description, so a pasted link shows a card in chat apps and on social sites
- [ ] **Structured description:** the page declares itself as a web application with name, description, author and address
- [ ] **Headings and link text:** one main heading per tab; no "click here" links
- [ ] **Images:** every meaningful image has a description; decorative ones are hidden from readers
- [ ] **Speed:** fonts load without blocking text; the first screen is usable within about 2 seconds on a normal connection; the script bundle is kept small
- [ ] **Robots and sitemap:** both served from the root; staging is marked not to be indexed
- [ ] **Not-found page:** unknown addresses show a helpful page with links back
- [ ] **Automated check:** a page-quality audit scores 90 or higher for search on the home tab

## Deployment

The app deploys the same way as your other homelab projects, with one difference: production must be public, because judges cannot sign in.

| Item | Value | Status |
| --- | --- | --- |
| Production address | moon.okoro.me | Assumed; change if you prefer another name or the free Space Apps domain |
| Staging address | moon-dev.okoro.me, behind the usual sign-in | Assumed |
| Stack | Own compose project: client, server and database containers; only the client joins the shared proxy network | From your hosting playbook |
| Ports | None published; containers expose ports to the proxy only | From your hosting playbook |
| Health check | /api/health, called on 127.0.0.1 inside the container | From your hosting playbook |
| Proxy rule | One site file per address, using the request-time resolver form | From your hosting playbook |
| Pipeline | Push to staging branch deploys staging; merge to main deploys production; smoke test after each | From your hosting playbook |
| Secrets | Written at deploy time from pipeline secrets; none in the repository | From your hosting playbook |
| Scheduled job | Daily watch check, run by the server | New |

## Licence and privacy

- **Licence:** MIT, with a README that names the data sources and states the model's limits. Assumed; change it if the rules name a licence.
- **What a watch stores:** the address to notify, the rule and the scenario. Nothing else.
- **Line on the form:** "We keep your address only to send this alert. Delete the watch and it is removed. All watch data is deleted 30 days after the event."
- **Every alert email** includes a link that stops the watch in one click.

## Dropped or deferred

| Item | Decision | Why |
| --- | --- | --- |
| Uploading a terrain profile exported from NASA's map tools | Deferred | No confirmation that those tools export one; computing profiles from the elevation map replaces it |
| Printable one-page mission brief | Deferred | Useful, but the change report covers the same need for now |
| Live countdown to sunset and Earthset | Deferred | The "next change" readout gives the same fact without a ticking clock |
| 3D terrain view | Dropped | Other entries do it well; it is not where this product competes |
| Combined fire and Moon tool | Dropped | One submission per team; the shared structure can be reused after the event |
| Slack and Teams alert channels | Deferred | Email first; web addresses carry extra risk |

## Team and project text

**Team name:** Moon Status

**Team description (for the 500-character field):**

Moon Status is a solo project by a Networking and IT Security student at Ontario Tech. I'm building a status page for the Moon: pick a landing site and date and see at a glance whether a lander would have sunlight for power and a line of sight to Earth. It adds what the usual tools lack: what happens if the landing misses by a few hundred metres, an alert when a schedule change breaks a site, and an API. Not looking for members, but happy to compare notes.

**Project summary (for the project page):**

Landing near the Moon's south pole depends on two things: sunlight for power and a clear line to Earth for contact. Both come and go, and a small change in place or date can decide a mission. Moon Status shows each landing site like a service on a status page, with a 30-day timeline, a plain-language report when plans change, a map of what happens if the lander misses its target, and alerts when a schedule change turns a good site bad. Positions come from NASA's JPL Horizons system; terrain for the demo site comes from the LOLA elevation map.

## Build prompt for a coding agent

Paste this into the coding agent at the start of the build; a fuller instruction file is supplied separately.

```
You are building Moon Status from the document "Moon Status: flow by flow".
Read it fully before writing code. The flow prototype decides behaviour;
the design canvas decides appearance.

Git rules, no exceptions: commit only as dan-od. No Co-Authored-By lines,
no "Generated with" lines, no AI or tool names in commits, pull requests,
branches or tags. Do not push unless asked.

Build in the order of the build table. Finish every Must item before any
Should item. Stop at the terrain checkpoint and report.

For each requirement: write a failing test, implement, run the test, then
run the flow by hand. Do not mark anything done without its "done when"
check passing. Deploy to staging at the end of each block.

NASA Horizons: server-side only, one request at a time, cache every reply.
Never call it from the browser.

Never invent data. If positions or terrain are missing, show the designed
empty or unavailable state. Never commit secrets.

Stop and ask before: production deploys, DNS changes, sending real email
to anyone but the owner, deleting data, or anything that costs money.

Report what is verified by test, verified by hand, and not verified.
```

## Waiting on publication

Checked on the morning of 14 November against the [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) and the [2026 event page](https://www.spaceappschallenge.org/2026/):

- **Deadline:** press "Submit for Judging" before Sunday 15 November, 11:59 p.m. local time. You can edit and resubmit; only the last saved version is judged. The Oshawa event may set an earlier in-person cut-off, so confirm with the organisers.
- **Demo:** required. Video or slides cannot be uploaded to the Space Apps site, so they must be hosted elsewhere and linked.
- **Language:** English on the project page and in linked materials.
- **Judging criteria:** Impact, Creativity, Validity, Relevance and Presentation, detailed in the 2026 Judging and Awards Guide (not yet read).
- **AI tools:** permitted. The project form asks whether they were used and how; answer it fully.
- **No one under 18** may appear in any image, video or audio.

Still not found: any rule on work done before the event, and any licence requirement. Read the Terms and Conditions and the Judging and Awards Guide to settle both.

## Weekend schedule

The schedule is in work blocks, not clock times, because the submission deadline for the Oshawa event still needs confirming.

| Block | Day | Work | Checkpoint at the end |
| --- | --- | --- | --- |
| 0 | Before starting | Read the rules; confirm the deadline; create the team; set up the repository with the dan-od identity and the commit hook; set up the deployment pipeline | An empty page is live on the staging address |
| 1 | Saturday | Foundation: fetch, queue, cache, calculator, site list | One site's positions are saved and match NASA |
| 2 | Saturday | API (sites, sky, windows) and the Console with real data | The Console shows real bars for five sites |
| 3 | Saturday | Start the elevation map download early; share link and spreadsheet file | A shared link restores the view |
| 4 | Saturday | Terrain preparation for the demo site | Horizon profiles exist for the grid. **Terrain checkpoint: if not, drop Miss and promote Watch** |
| 5 | Sunday | Miss view | Aim moves, odds update, safest spot works |
| 6 | Sunday | Compare and change report | Four quick setups produce correct reports |
| 7 | Sunday | First Should item that fits: Watch by email, then assistant connector, then Add coordinates | Each is finished or not started; nothing half-done |
| 8 | Sunday | Freeze features. Demo recording, write-up, project page, final checks | Submitted with time to spare |

- Deploy to staging at the end of every block, so there is always a working version to submit.
- Promote staging to production once before the demo is recorded, and not again after.

## Demo script

The demo tells one true story in under two minutes: a real lander died 250 m from its target, and this tool shows why and what to do about it.

1. **The problem (15 seconds).** March 2025: a lander reached the Moon's south pole, came down 250 m off target in a crater, and lost power within a day.
2. **Console (20 seconds).** Open on that site and date. On a smooth Moon it looks ready. Scrub the timeline to show sunlight and Earth contact over 30 days.
3. **Miss (30 seconds).** Open Miss. The dark crater sits inside the yellow ring. Read the odds at 250 m. Press "Move to the safest spot" and watch the number rise.
4. **Compare (15 seconds).** Target against the new aim: the report says in plain words what improves.
5. **Watch (20 seconds).** Start a watch, slip the date 10 days, show the alert arriving.
6. **Reach (10 seconds).** One API call, or one question to an assistant, returning the same numbers.
7. **Honesty (10 seconds).** What is modelled and what is not.

Every number shown in the demo must come from real positions and real terrain. If Miss was dropped at the checkpoint, steps 3 and 4 are replaced by a date-slip comparison.

## Submission checklist

- [ ] Rules and judging criteria read; submission format confirmed (video, slides or both)
- [ ] Submission deadline for the Oshawa event confirmed
- [ ] Team created under Lunar Landing Site Navigator
- [ ] Project page text: what it does, how it works, data used, what is not modelled
- [ ] Data and resources credited: JPL Horizons, the LOLA south pole elevation map, the Space Apps brand assets
- [ ] AI use declared in the form the rules ask for
- [ ] Public code link, with history showing dan-od only
- [ ] Live address works from a phone and from a clean browser
- [ ] No NASA insignia; Space Apps logo unaltered
- [ ] Project added to okoro.me and the uptime monitor after the event

## Risks

| Risk | Likelihood | Effect | Response |
| --- | --- | --- | --- |
| Terrain preparation takes too long or the file will not open | Medium | Miss cannot ship with real data | Start the download in block 3; hard checkpoint at the end of block 4; fall back to Watch |
| NASA's service is slow or limits requests | Low | Sites load slowly | Fetch the curated sites once, early; everything after reads the cache |
| Scope exceeds the hours available | High | Unfinished features in the submission | Build in tier order; never start a Should item with a Must item open |
| Smooth-Moon results contradict reality at a site | Certain at the pole | A judge sees a site marked ready that is in shadow | State the model on every screen; use the shadow allowance; show real terrain on the demo site |
| Email alerts land in spam during the demo | Medium | The alert step fails live | Record that step in advance; show the event log as well |
| Coordinates for a listed site are wrong | Medium | Loss of credibility | Cite a source per site; leave out any site without one |
| Other entries already cover a claimed gap | Medium | The pitch overclaims | Say "none of the entries we reviewed" and name how many were read |
| Rules restrict pre-event work or AI help | Unknown | Disqualification risk | Read the rules in block 0 and follow them; rebuild rather than reuse if required |

## Repository rules for the build

Every commit, push, pull request and merge shows dan-od as the only author, with no AI attribution of any kind.

- **Identity:** commits and pushes are made only under the dan-od git identity. Never commit or push under any other name or account.
- **No AI co-author lines:** no "Co-Authored-By" line naming Claude, Anthropic, Copilot, OpenAI, Gemini or any other AI provider or tool.
- **No AI footers:** no "Generated with" line, session link or tool name in commit messages, pull request titles or pull request descriptions.
- **No AI names elsewhere in git:** not in branch names, tags or the author and committer fields.
- **Tool settings:** any coding assistant used has its attribution setting turned off before the first commit.
- **Backstop:** a commit-msg hook strips such lines, the same way the KanbanAI repository does.
- **Applies to every agent and tool** that works in this repository, including Claude.

This rule is about git history only. Declaring AI help to the hackathon, if the 2026 rules require it, is done in the submission itself.

## Decisions and open questions

| Decision | Status |
| --- | --- |
| Challenge: Lunar Landing Site Navigator | Locked |
| Solo team under the Oshawa local event | Locked |
| Four gaps to fill: miss tolerance, watch and alert, API with assistant connector, plain-language change report | Approved in chat |
| Full version of miss tolerance, with real terrain for one site | Approved in chat |
| Console-style layout in the Space Apps brand colours and fonts | Approved in chat |
| Miss screen as a round shaded map with a movable aim and three odds lines | Approved in chat |
| Shared scenario carried in the page address | Approved in chat |
| No accounts; watches confirmed by email | Assumed |
| Opens on the 2025 landing case | Assumed |
| Name: Moon Status | Assumed |
| Stack: React and TypeScript front end, Express and PostgreSQL server, Python script for terrain | Assumed, from your usual tools |
| Hosting on your homelab under a subdomain, deployed by your existing pipeline | Assumed |
| Email through your existing sending account | Assumed |

Open questions, each with a recommended answer:

- [ ] **Do you approve the flow prototype as the design to build?** Recommended: yes, with any last changes listed. Production screens should not start without this.
- [ ] **What do the 2026 rules say about work done before the event and about declaring AI use?** Recommended: read them first thing and declare the design and research help. I have not seen the rules.
- [ ] **Which sites go in the list, and what is the source for each coordinate?** Recommended: five sites to start; the Shackleton ridge coordinates and the 2025 touchdown position still need a source.
- [ ] **Is the stack assumption right?** Recommended: yes, it matches what you already deploy.
- [ ] **Email only for alerts in the first version?** Recommended: yes. Web addresses add the internal-network risk and can wait.
- [ ] **Keep the 2025 landing as the opening case?** Recommended: yes, once the real positions for that date are loaded and checked.
