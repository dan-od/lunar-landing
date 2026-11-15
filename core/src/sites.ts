// The curated starter sites (F-5). Each has a cited coordinate source; any site
// without one is left out (AGENTS.md data rules). Longitude is degrees east.
import type { Site } from './types.js';

export const CURATED_SITES: Site[] = [
  {
    id: 'im2',
    name: 'IM-2 target, Mons Mouton',
    short: 'IM-2',
    lat: -84.78,
    lon: 29.13,
    heightKm: 0,
    source: 'LROC, https://www.lroc.asu.edu/images/1401',
    hasTerrain: true,
  },
  {
    id: 'im1',
    name: 'IM-1 Odysseus, near Malapert A',
    short: 'IM-1',
    lat: -80.13,
    lon: 1.44,
    heightKm: 2.579,
    source: 'NASA, https://www.nasa.gov/?p=620655',
    hasTerrain: false,
  },
  {
    id: 'shk',
    name: 'Shackleton–de Gerlache ridge',
    short: 'Shackleton',
    lat: -89.684,
    lon: 196.739,
    heightKm: 0,
    source: 'LROC, https://www.lroc.asu.edu/images/1247',
    hasTerrain: false,
  },
  {
    id: 'ch3',
    name: 'Chandrayaan-3, Statio Shiv Shakti',
    short: 'Ch-3',
    lat: -69.373,
    lon: 32.319,
    heightKm: 0,
    source: 'IAU-approved site, https://en.wikipedia.org/wiki/Statio_Shiv_Shakti',
    hasTerrain: false,
  },
  {
    id: 'ap11',
    name: 'Apollo 11 lunar module',
    short: 'Apollo 11',
    lat: 0.67416,
    lon: 23.47314,
    heightKm: 0,
    source: 'NASA NSSDC, https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
    hasTerrain: false,
  },
];

export function getCuratedSite(id: string): Site | undefined {
  return CURATED_SITES.find((s) => s.id === id);
}
