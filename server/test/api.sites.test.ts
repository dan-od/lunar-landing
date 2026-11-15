// The grown site list: every site has its group and its cited source; notes
// (crash site, converted longitude) travel with it.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { CURATED_SITES } from '@moon/core';
import { createV1Router } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo } from '../src/api/providers.js';

const app = express();
app.use('/v1', createV1Router({ sitesRepo: staticSitesRepo(), seriesProvider: { async get() { throw new Error('unused'); } } }));
app.use(apiErrorHandler);

describe('GET /v1/sites (grouped list)', () => {
  it('lists every curated site with its group and source', async () => {
    const res = await request(app).get('/v1/sites');
    expect(res.status).toBe(200);
    expect(res.body.sites.length).toBe(CURATED_SITES.length);
    for (const s of res.body.sites) {
      expect(['Artemis III candidates', 'South pole', 'Apollo', 'Other landers']).toContain(s.group);
      expect(s.source).toMatch(/https:\/\//);
    }
    expect(res.body.sites.find((s: { id: string }) => s.id === 'vikram')).toMatchObject({ group: 'South pole', note: expect.stringMatching(/Crash site/) });
  });
});
