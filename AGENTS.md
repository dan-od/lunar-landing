# Moon Status: instructions for any agent or tool working in this repository

Moon Status is a web app for the 2026 NASA Space Apps challenge "Lunar Landing Site
Navigator". It answers one question: at a given place on the Moon and a given time,
does a lander have sunlight for power and a line of sight to Earth?

## Sources of truth, in order

1. The owner's current instruction.
2. These rules.
3. The document "Moon Status: flow by flow" (requirements, flows, contracts, security).
4. The flow prototype (behaviour, states, wording).
5. The design canvas (appearance).
6. Your own judgement.

Where the prototype and the canvas differ, the prototype wins.

## Git rules (no exceptions)

- Commit only as dan-od. Never commit or push under any other name or account.
- No `Co-Authored-By` line naming Claude, Anthropic, Copilot, OpenAI, Gemini or any
  other AI provider or tool.
- No "Generated with" line, session link or tool name in commit messages, pull
  request titles or pull request descriptions.
- No AI or tool names in branch names, tags, or author and committer fields.
- Turn off attribution in any coding assistant before the first commit.
- Keep the `commit-msg` hook that strips such lines.
- Do not push unless the owner asks.
- Branches: `feature/...` or `fix/...` off `staging`; pull request into `staging`;
  then `staging` into `main`. Never delete `staging`.

## Build rules

- Build in the order of the build table in the document. Finish every Must item
  before starting any Should item.
- Terrain checkpoint: if horizon profiles are not being produced by the end of
  block 4, stop, report, and wait for the owner's decision.
- For each requirement: write a failing test, implement, run the test, then run
  the flow by hand. A requirement is done only when its "done when" check passes.
- Deploy to staging at the end of every work block.
- One calculator: pages, files, API and the assistant connector all use the same
  window calculator. Never duplicate the logic.
- Every reply and exported file names the model used (smooth Moon or terrain).

## Data rules

- NASA Horizons: server-side only, one request at a time, cache every reply and
  reuse it. Never call it from the browser.
- Never invent data. If positions or terrain are missing, show the designed
  loading, unavailable or no-terrain state.
- Verify the direction convention (degrees clockwise from north) between NASA
  positions and terrain profiles before trusting the Miss view.
- "A landing works" means Sun and Earth above the horizon at touchdown and for at
  least 90% of the first 10 days.
- Times are UTC. Allowed dates are 2020-01-01 to 2040-12-31.

## Security rules

- No secrets in the repository. Secrets come from deployment secrets at deploy time.
- No alert is sent until the address owner has confirmed. Confirmation links
  expire after 24 hours.
- Alert web addresses: https only; refuse localhost, private and link-local
  ranges and raw numeric addresses; check the resolved address; follow no redirects.
- Rate limit every endpoint per visitor.
- Escape user text on screen and in files; exported cells never start a formula.
- Mask email and alert addresses in logs.

## Hosting conventions (from the homelab playbook)

- Own compose project; only the public-facing container joins the external `web`
  network; the database joins the internal network only.
- No `ports:`; use `expose:`. Always set `container_name`.
- Health checks call `127.0.0.1`, never `localhost`.
- One proxy site file per address, using the request-time resolver form.
- Production is public. Staging stays behind the sign-in.
- Change infrastructure in the repository, never on the server.

## Design rules

- Space Apps brand colours and fonts as listed in the document. Corner radius 0.
- State is never shown by colour alone: symbol and word every time.
- Every control at least 44 px. Every action reachable by keyboard.
- Only the Space Apps logo, unaltered. No NASA insignia.

## Stop and ask the owner before

- Deploying to production or changing DNS.
- Sending real email to anyone other than the owner.
- Deleting data.
- Anything that costs money.
- Changing a shared contract between flows.

## Reporting

At the end of each block, report three lists: verified by automated test,
verified by hand, and not verified (with the reason).
