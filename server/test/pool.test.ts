import { describe, it, expect } from 'vitest';
import { poolOptions } from '../src/db/pool.js';

describe('poolOptions', () => {
  it('uses DATABASE_URL when it is set', () => {
    expect(poolOptions({ DATABASE_URL: 'postgres://u:p@h:5432/d' })).toEqual({
      connectionString: 'postgres://u:p@h:5432/d',
    });
  });

  it('leaves the separate PG values to node-postgres, so no URL is built from the password', () => {
    const options = poolOptions({ PGHOST: 'moon-db', PGUSER: 'moon', PGPASSWORD: 'p@ss/w#rd?%x', PGDATABASE: 'm' });
    expect(options).toEqual({});
  });

  it('reports no database when neither is set', () => {
    expect(poolOptions({})).toBeUndefined();
  });
});
