# Moon Status: report for the owner

Written 2026-11-15, end of the second unattended session (started about
06:30 EST). Every step of your list was done, in order, and pushed to `staging`
after each step: 21 commits from `a7addb7`. Nothing went to `main`. All commits
are dan-od with no tool lines; nothing was force-pushed.

The full requirement-by-requirement result is in
[docs/acceptance.md](docs/acceptance.md). Screenshots of each tab on the 2025
case are in [docs/screens/](docs/screens/).

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
| 9 | Watch by email as the PRD defines it: sign-up, 24-hour confirmation link, four rules on the one calculator, re-check on scenario change and daily, one alert per break, one-click unsubscribe that deletes the address, limits, masked logs, privacy line above Start, delete with a Keep it dialog. Sends through Resend from `Moon Status <moon@okoro.me>`. **Off unless both `EMAIL_SENDING_KEY` and `TOKEN_SIGNING_SECRET` are set**; the deploy workflow's `.env` step and compose now pass both. Tested with a fake sender only; no real email was sent. |
| 3 | "How we know it's right": a panel on the API tab (linked from Help and the status bar) and the README section. Apollo 11: our Sun height at 1969-07-20 20:17 UTC is **10.7°**; NASA SP-2000-4029 gives **10.8°** (with the caution that the book also lists 10.8° as the planned angle). |
| 4 | README and CREDITS complete, including the exact LOLA product page and citation (PGDA product 90, Barker et al. 2023), Resend, and a "Use of AI tools" section. |
| 5 | Desktop screenshots of all five tabs. |
| 6 | Acceptance run: [docs/acceptance.md](docs/acceptance.md). |
| 7 | Incident list (1-12) on the Console: next changes across all sites, soonest first. |

## Verified by automated test

- 250 tests pass: 54 core, 139 server, 57 client (`npm test`), plus typecheck,
  lint and build. New tests this session cover: Now uses UTC; seed spans;
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
- Phone layout at 390 px on all tabs.
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
- **A screen-reader run** (A-7, A-8), the preview card in a chat app (E-2), a
  question through a real assistant (8-1).
- **The daily timer wrapper** (`startScheduler`) has no test; the daily check it
  runs does.
- **No "queued additions" were found.** Your restart note mentioned them, but
  there were no queued notifications and nothing in the conversation or the
  repository, so nothing extra was done.

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
   - Opening the unsubscribe link deletes the watch at once, as specified. A
     mail scanner that follows links could trigger it.
   - The "3 confirmation emails per address per day" cap is held in memory and
     resets when the server restarts.
   - Watch data is deleted after 2026-12-15 (`WATCH_DATA_DELETE_AFTER`).
5. **Explain mode (1-10), status badge (6-3) and web alert addresses (5-7)**
   were not built. Help and the term hints cover most of what explain mode
   would.
6. **Brand kit files** (Space Apps logo, orbit pattern) are still not in the
   repository, so neither is shown. The README now says so instead of claiming
   the logo is used.
