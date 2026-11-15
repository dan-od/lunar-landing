// Shared domain types. These are the vocabulary the whole app agrees on so that
// pages, files, the API and the assistant connector cannot disagree.

/** The two bodies we track. NASA Horizons COMMAND ids: Sun = 10, Earth = 399. */
export type Body = 'sun' | 'earth';

/** A curated or custom landing site. Longitude is degrees EAST, as Horizons expects. */
/** Groups in the site list. */
export type SiteGroup = 'Artemis III candidates' | 'South pole' | 'Apollo' | 'Other landers';

export interface Site {
  id: string;
  name: string;
  short: string;
  /** Latitude in degrees; negative is south. */
  lat: number;
  /** Longitude in degrees east (0..360 or -180..180 are both accepted on input). */
  lon: number;
  /** Site height above the reference surface, in km. 0 unless terrain is prepared. */
  heightKm: number;
  /** Citation for the coordinates (F-5: every site has a source). */
  source: string;
  /** True only where terrain horizon profiles are prepared. */
  hasTerrain: boolean;
  /** Set for user-added sites; curated sites leave it undefined. */
  custom?: boolean;
  /** Where the site sits in the list (curated sites only). */
  group?: SiteGroup;
  /** Anything a reader should know about the coordinates (crash site, converted longitude). */
  note?: string;
}

/**
 * One hourly position row as returned by Horizons (quantity 4: azimuth + elevation).
 * Direction is degrees clockwise from north (0..360); elevation is height above the
 * local horizon in degrees. This convention is shared with terrain profiles (F-6).
 */
export interface PositionRow {
  /** ISO-8601 UTC timestamp for the hour. */
  time: string;
  body: Body;
  /** Azimuth, degrees clockwise from north (0..360). */
  azimuthDeg: number;
  /** Elevation above the horizon, degrees. Negative means below the horizon. */
  elevationDeg: number;
}

/** The shared scenario. It lives in the page address so tabs, links and exports agree. */
export interface Scenario {
  siteId: string;
  /** Landing date, YYYY-MM-DD (UTC). */
  date: string;
  /** Landing hour (UTC), 0..23. */
  hour: number;
  /** Shadow allowance in degrees: how far above the horizon a body must be to count. */
  marginDeg: number;
  /** Landing accuracy in metres. */
  accuracyM: number;
  /** Aim offset in metres (east, north) relative to the target. */
  aim: { east: number; north: number };
}

/** The four locked state words. State is never shown by colour alone. */
export type StateWord = 'READY' | 'NO POWER' | 'NO LINK' | 'DARK, NO LINK';

export interface SiteState {
  word: StateWord;
  /** Symbol that always accompanies the word. */
  symbol: string;
  powerUp: boolean;
  linkUp: boolean;
}

/** An unbroken stretch where a condition holds. */
export interface Window {
  /** ISO-8601 UTC start of the window. */
  start: string;
  /** ISO-8601 UTC end of the window. */
  end: string;
  /** Length in hours. */
  hours: number;
}

/** Everything the window calculator derives for one body over a span. */
export interface BodySummary {
  /** Percent of the span the body is above the allowance (0..100). */
  uptimePct: number;
  /** Longest unbroken stretch below the allowance, in days. */
  longestGapDays: number;
  /** Hours from the landing moment to the next change, or null if none in span. */
  nextChangeHours: number | null;
  windows: Window[];
}

/** The full calculator result for a scenario over a span. */
export interface WindowResult {
  model: ModelName;
  power: BodySummary;
  contact: BodySummary;
  /** State at the landing moment. */
  landing: SiteState;
  /** True when "works": ready at touchdown and for >=90% of the first 10 days. */
  works: boolean;
}

/** Every reply and exported file names the model used. */
export type ModelName = 'smooth Moon' | 'terrain';
