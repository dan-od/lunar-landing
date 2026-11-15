// The five sections, each with its own address, page title and description (E-1).
export interface TabDef {
  path: string;
  label: string;
  title: string;
  description: string;
}

export const TABS: TabDef[] = [
  {
    path: '/',
    label: 'CONSOLE',
    title: 'Moon Status: will a lunar lander have power and a line to Earth?',
    description:
      "Pick a landing site near the Moon's south pole and a date, and see whether a lander would have sunlight for power and a line of sight to Earth over the next 30 days.",
  },
  {
    path: '/compare',
    label: 'COMPARE',
    title: 'Moon Status: compare two landing cases',
    description:
      'Compare two landing sites, dates or hours side by side and read a plain-language report of what gets better, worse or stays the same.',
  },
  {
    path: '/miss',
    label: 'MISS',
    title: 'Moon Status: what if the landing misses?',
    description:
      'See how many landings out of 10 would still have power and Earth contact if the lander comes down 100, 250 or 320 metres off target, on real lunar terrain, and find a safer place to aim.',
  },
  {
    path: '/watch',
    label: 'WATCH',
    title: 'Moon Status: watch a landing site',
    description:
      'See when the Sun and Earth will rise and set at a lunar landing site over the 30 days after landing, and add each change to your calendar with a reminder.',
  },
  {
    path: '/api',
    label: 'API',
    title: 'Moon Status: the API',
    description:
      'The same answers by program: sites, Sun and Earth positions, power and contact windows, change reports and landing-miss odds.',
  },
];

export const tabFor = (path: string): TabDef | undefined => TABS.find((t) => t.path === path);
