// The five sections, each with its own address and page title (E-1).
export interface TabDef {
  path: string;
  label: string;
  title: string;
}

export const TABS: TabDef[] = [
  {
    path: '/',
    label: 'CONSOLE',
    title: 'Moon Status: will a lunar lander have power and a line to Earth?',
  },
  { path: '/compare', label: 'COMPARE', title: 'Moon Status: compare two landing cases' },
  { path: '/miss', label: 'MISS', title: 'Moon Status: what if the landing misses?' },
  { path: '/watch', label: 'WATCH', title: 'Moon Status: watch a site and be alerted' },
  { path: '/api', label: 'API', title: 'Moon Status: the API' },
];
