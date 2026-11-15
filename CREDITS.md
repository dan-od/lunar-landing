# Credits

Every data source, library, font and asset Moon Status uses, with a link and a
licence for each. Update this file whenever a dependency, font, data source or
asset is added or removed.

## Data sources

| Source | Used for | Link | Licence / terms |
| --- | --- | --- | --- |
| NASA JPL Horizons System | Hourly direction and height of the Sun and Earth from a point on the Moon | https://ssd.jpl.nasa.gov/horizons/ (API: https://ssd-api.jpl.nasa.gov/doc/horizons.html) | NASA/JPL data, not copyrighted as a U.S. Government work; used under JPL's API fair-use rules (one request at a time, replies cached). Credit: NASA/JPL-Caltech, Solar System Dynamics |
| LOLA south pole elevation map, `LDEM_80S_80MPP_ADJ.TIF` (NASA Goddard) | Terrain horizon profiles for the demo site (Miss view). Kept out of the repository | https://pgda.gsfc.nasa.gov/ (Planetary Geodesy Data Archive, NASA GSFC) | NASA data, not copyrighted as a U.S. Government work. Credit: NASA GSFC / LOLA science team. Exact product page and citation to be confirmed before submission |

### Site coordinates

| Site | Source | Link |
| --- | --- | --- |
| IM-2 target, Mons Mouton | LROC (Arizona State University / NASA) | https://www.lroc.asu.edu/images/1401 |
| IM-1 Odysseus, near Malapert A | NASA | https://www.nasa.gov/?p=620655 |
| Shackleton–de Gerlache ridge | LROC (Arizona State University / NASA) | https://www.lroc.asu.edu/images/1247 |
| Chandrayaan-3, Statio Shiv Shakti | IAU-approved name; coordinates as listed on Wikipedia (text CC BY-SA 4.0) | https://en.wikipedia.org/wiki/Statio_Shiv_Shakti |
| Apollo 11 lunar module | NASA NSSDC | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |

Only the coordinates (facts) are used from these pages; no text or images are copied.

## Brand assets

| Asset | Link | Terms |
| --- | --- | --- |
| NASA Space Apps Challenge brand assets (colours, fonts, official logo, orbit pattern), used unaltered under the Space Apps Brand Guide | https://www.spaceappschallenge.org/brand/ | Space Apps Brand Guide. Original files only, never edited or regenerated. The logo appears in one place only, the footer. No NASA insignia is used |

Status: the brand colours and fonts are in use. The logo and orbit pattern files
are not in the repository yet, so neither is shown; they will be added from the
original brand kit files only.

The small Moon mark beside the words "Moon Status" in the header is an original
drawing made for this project. It is not a NASA or Space Apps asset. The same
mark is the page icon (`client/public/favicon.svg`).

The link preview image (`client/public/og.png`, 1200 × 630) is also original: it
shows only the name Moon Status, that mark, a headline and the four state tags,
in the brand colours and fonts. It contains no NASA or Space Apps logo, pattern
or name. Its source is `docs/og-card.html`.

## Fonts

Loaded from Google Fonts (https://fonts.google.com/).

| Font | Used for | Link | Licence |
| --- | --- | --- | --- |
| Fira Sans (Black, Bold) | Headings | https://fonts.google.com/specimen/Fira+Sans | SIL Open Font License 1.1 |
| Overpass | Body text and controls | https://fonts.google.com/specimen/Overpass | SIL Open Font License 1.1 |
| Fira Code | Readouts, coordinates and pane labels | https://fonts.google.com/specimen/Fira+Code | SIL Open Font License 1.1 |

## Libraries that ship in the app

| Library | Where | Link | Licence |
| --- | --- | --- | --- |
| React, React DOM | client | https://react.dev/ | MIT |
| React Router (`react-router-dom`) | client | https://github.com/remix-run/react-router | MIT |
| Express | server | https://expressjs.com/ | MIT |
| node-postgres (`pg`) | server | https://github.com/brianc/node-postgres | MIT |
| dotenv | server | https://github.com/motdotla/dotenv | BSD-2-Clause |

## Tools used to build and test

| Tool | Link | Licence |
| --- | --- | --- |
| TypeScript | https://www.typescriptlang.org/ | Apache-2.0 |
| Vite, `@vitejs/plugin-react` | https://vite.dev/ | MIT |
| Vitest | https://vitest.dev/ | MIT |
| tsx | https://tsx.is/ | MIT |
| ESLint, `@eslint/js` | https://eslint.org/ | MIT |
| typescript-eslint | https://typescript-eslint.io/ | MIT |
| SuperTest | https://github.com/ladjs/supertest | MIT |
| axe-core (accessibility scanner, used to check each tab) | https://github.com/dequelabs/axe-core | MPL-2.0 |
| Type definitions (`@types/express`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`, `@types/supertest`) | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT |

## Runtime and hosting software

| Software | Used as | Link | Licence |
| --- | --- | --- | --- |
| Node.js | Server runtime and build image | https://nodejs.org/ | MIT |
| PostgreSQL (`postgres:16-alpine` image) | Database | https://www.postgresql.org/ | PostgreSQL License |
| nginx (`nginx:1.27-alpine` image) | Serves the built front end | https://nginx.org/ | BSD-2-Clause |

## Deployment tools

| Tool | Used as | Link | Licence |
| --- | --- | --- | --- |
| `actions/checkout` | Checks out the code in the deploy workflow | https://github.com/actions/checkout | MIT |
| `tailscale/github-action` | Joins the private network to reach the host | https://github.com/tailscale/github-action | BSD-3-Clause |

Moon Status itself is released under the MIT licence (see [LICENSE](LICENSE)).
