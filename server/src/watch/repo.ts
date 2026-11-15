// Where watches and their event log are kept. All SQL lives behind this
// interface; tests use the in-memory version. A watch stores only the address,
// the rule and the scenario (plus what is needed to confirm, manage and check it).
import type pg from 'pg';
import type { RuleId, WatchScenario } from './rules.js';

/** Stored status. "expired" is a waiting watch whose confirmation link ran out. */
export type WatchStatus = 'pending' | 'expired' | 'active' | 'tripped';

export interface WatchRow {
  id: string;
  siteId: string;
  scenario: WatchScenario;
  rule: RuleId;
  address: string;
  status: WatchStatus;
  /** Keyed hash of the single-use confirmation token; null once used. */
  confirmHash: string | null;
  /** When the confirmation link stops working (epoch ms). */
  confirmExpiry: number | null;
  /** Keyed hash of the private manage token. */
  manageHash: string;
  createdAt: number;
  confirmedAt: number | null;
  lastCheckedAt: number | null;
  updatedAt: number;
  /** Start of the current 24-hour window for the alert email cap, and the count in it. */
  alertWindowStart: number | null;
  alertCount: number;
}

export interface WatchEvent {
  time: number;
  level: string;
  message: string;
}

export type NewWatch = Pick<
  WatchRow,
  'siteId' | 'scenario' | 'rule' | 'address' | 'confirmHash' | 'confirmExpiry' | 'manageHash' | 'createdAt'
>;

export type WatchPatch = Partial<
  Pick<
    WatchRow,
    | 'scenario'
    | 'status'
    | 'confirmHash'
    | 'confirmExpiry'
    | 'confirmedAt'
    | 'lastCheckedAt'
    | 'alertWindowStart'
    | 'alertCount'
  >
>;

export interface WatchRepo {
  create(watch: NewWatch): Promise<WatchRow>;
  get(id: string): Promise<WatchRow | undefined>;
  findByManageHash(hash: string): Promise<WatchRow | undefined>;
  findByConfirmHash(hash: string): Promise<WatchRow | undefined>;
  /** How many watches an address has, whatever their state. Letter case is ignored. */
  countByAddress(address: string): Promise<number>;
  listByStatus(statuses: WatchStatus[]): Promise<WatchRow[]>;
  update(id: string, patch: WatchPatch, now: number): Promise<void>;
  addEvent(id: string, level: string, message: string, time: number): Promise<void>;
  /** A watch's events, oldest first. */
  events(id: string): Promise<WatchEvent[]>;
  /** Remove a watch and its events. True when there was one. */
  delete(id: string): Promise<boolean>;
  /** Remove every watch and every event. Returns how many watches went. */
  deleteAll(): Promise<number>;
}

/** Watches held in memory, for tests. */
export class MemoryWatchRepo implements WatchRepo {
  private nextId = 1;
  private readonly watches = new Map<string, WatchRow>();
  private readonly log = new Map<string, WatchEvent[]>();

  async create(w: NewWatch): Promise<WatchRow> {
    const row: WatchRow = {
      ...w,
      id: String(this.nextId++),
      status: 'pending',
      confirmedAt: null,
      lastCheckedAt: null,
      updatedAt: w.createdAt,
      alertWindowStart: null,
      alertCount: 0,
    };
    this.watches.set(row.id, row);
    this.log.set(row.id, []);
    return { ...row };
  }

  async get(id: string): Promise<WatchRow | undefined> {
    const row = this.watches.get(id);
    return row ? { ...row } : undefined;
  }

  async findByManageHash(hash: string): Promise<WatchRow | undefined> {
    for (const w of this.watches.values()) if (w.manageHash === hash) return { ...w };
    return undefined;
  }

  async findByConfirmHash(hash: string): Promise<WatchRow | undefined> {
    for (const w of this.watches.values()) if (w.confirmHash === hash) return { ...w };
    return undefined;
  }

  async countByAddress(address: string): Promise<number> {
    const wanted = address.toLowerCase();
    return [...this.watches.values()].filter((w) => w.address.toLowerCase() === wanted).length;
  }

  async listByStatus(statuses: WatchStatus[]): Promise<WatchRow[]> {
    return [...this.watches.values()].filter((w) => statuses.includes(w.status)).map((w) => ({ ...w }));
  }

  async update(id: string, patch: WatchPatch, now: number = Date.now()): Promise<void> {
    const row = this.watches.get(id);
    if (row) Object.assign(row, patch, { updatedAt: now });
  }

  async addEvent(id: string, level: string, message: string, time: number): Promise<void> {
    this.log.get(id)?.push({ time, level, message });
  }

  async events(id: string): Promise<WatchEvent[]> {
    return (this.log.get(id) ?? []).map((e) => ({ ...e }));
  }

  async delete(id: string): Promise<boolean> {
    this.log.delete(id);
    return this.watches.delete(id);
  }

  async deleteAll(): Promise<number> {
    const n = this.watches.size;
    this.watches.clear();
    this.log.clear();
    return n;
  }

  /** How many watches are held (tests). */
  size(): number {
    return this.watches.size;
  }

  /** Everything held, to search for what should not be there (tests). */
  dump(): { watches: WatchRow[]; events: WatchEvent[] } {
    return { watches: [...this.watches.values()], events: [...this.log.values()].flat() };
  }
}

const ms = (v: unknown): number | null => (v == null ? null : new Date(v as string | Date).getTime());
const ts = (v: number | null | undefined): Date | null => (v == null ? null : new Date(v));

function rowToWatch(r: Record<string, unknown>): WatchRow {
  return {
    id: String(r.id),
    siteId: String(r.site_id),
    scenario: r.scenario as WatchScenario,
    rule: r.rule as RuleId,
    address: String(r.address),
    status: r.status as WatchStatus,
    confirmHash: r.token_hash == null ? null : String(r.token_hash),
    confirmExpiry: ms(r.token_expiry),
    manageHash: String(r.manage_link_hash),
    createdAt: ms(r.created_at)!,
    confirmedAt: ms(r.confirmed_at),
    lastCheckedAt: ms(r.last_checked_at),
    updatedAt: ms(r.updated_at)!,
    alertWindowStart: ms(r.alert_window_start),
    alertCount: Number(r.alert_count),
  };
}

/** Column and value for each field a patch may carry. */
const PATCH_COLUMNS: { [K in keyof Required<WatchPatch>]: [string, (v: Required<WatchPatch>[K]) => unknown] } = {
  scenario: ['scenario', (v) => JSON.stringify(v)],
  status: ['status', (v) => v],
  confirmHash: ['token_hash', (v) => v],
  confirmExpiry: ['token_expiry', (v) => ts(v)],
  confirmedAt: ['confirmed_at', (v) => ts(v)],
  lastCheckedAt: ['last_checked_at', (v) => ts(v)],
  alertWindowStart: ['alert_window_start', (v) => ts(v)],
  alertCount: ['alert_count', (v) => v],
};

/** Watches in PostgreSQL (tables `watches` and `events`). */
export function pgWatchRepo(pool: pg.Pool): WatchRepo {
  const one = async (sql: string, params: unknown[]): Promise<WatchRow | undefined> => {
    const { rows } = await pool.query(sql, params);
    return rows[0] ? rowToWatch(rows[0]) : undefined;
  };
  // Ids are whole numbers; anything else cannot be a watch.
  const isId = (id: string) => /^\d{1,18}$/.test(id);

  return {
    async create(w) {
      const { rows } = await pool.query(
        `INSERT INTO watches
           (site_id, scenario, rule, address, status, token_hash, token_expiry, manage_link_hash, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3, $4, 'pending', $5, $6, $7, $8, $8)
         RETURNING *`,
        [
          w.siteId,
          JSON.stringify(w.scenario),
          w.rule,
          w.address,
          w.confirmHash,
          ts(w.confirmExpiry),
          w.manageHash,
          ts(w.createdAt),
        ],
      );
      return rowToWatch(rows[0]);
    },
    async get(id) {
      return isId(id) ? one('SELECT * FROM watches WHERE id = $1', [id]) : undefined;
    },
    async findByManageHash(hash) {
      return one('SELECT * FROM watches WHERE manage_link_hash = $1 LIMIT 1', [hash]);
    },
    async findByConfirmHash(hash) {
      return one('SELECT * FROM watches WHERE token_hash = $1 LIMIT 1', [hash]);
    },
    async countByAddress(address) {
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM watches WHERE lower(address) = lower($1)', [
        address,
      ]);
      return Number(rows[0].n);
    },
    async listByStatus(statuses) {
      const { rows } = await pool.query('SELECT * FROM watches WHERE status = ANY($1::text[]) ORDER BY id', [statuses]);
      return rows.map(rowToWatch);
    },
    async update(id, patch, now) {
      if (!isId(id)) return;
      const sets = ['updated_at = $2'];
      const params: unknown[] = [id, ts(now)];
      for (const key of Object.keys(PATCH_COLUMNS) as Array<keyof WatchPatch>) {
        if (!(key in patch)) continue;
        const [column, toDb] = PATCH_COLUMNS[key] as [string, (v: unknown) => unknown];
        params.push(toDb(patch[key]));
        sets.push(`${column} = $${params.length}${column === 'scenario' ? '::jsonb' : ''}`);
      }
      await pool.query(`UPDATE watches SET ${sets.join(', ')} WHERE id = $1`, params);
    },
    async addEvent(id, level, message, time) {
      if (!isId(id)) return;
      // Nothing is written for a watch that has just been deleted.
      await pool.query(
        `INSERT INTO events (watch_id, time, level, message)
         SELECT id, $2, $3, $4 FROM watches WHERE id = $1`,
        [id, ts(time), level, message],
      );
    },
    async events(id) {
      if (!isId(id)) return [];
      const { rows } = await pool.query('SELECT time, level, message FROM events WHERE watch_id = $1 ORDER BY time, id', [
        id,
      ]);
      return rows.map((r) => ({ time: ms(r.time)!, level: String(r.level), message: String(r.message) }));
    },
    async delete(id) {
      if (!isId(id)) return false;
      // events go with the watch (ON DELETE CASCADE).
      const res = await pool.query('DELETE FROM watches WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    },
    async deleteAll() {
      const res = await pool.query('DELETE FROM watches');
      // Belt and braces: no event may outlive its watch.
      await pool.query('DELETE FROM events');
      return res.rowCount ?? 0;
    },
  };
}
