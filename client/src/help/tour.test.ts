// Every tour step points at something that exists on both layouts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOUR } from './content';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const phoneSource = src('../console/PhoneConsole.tsx') + src('../components/DateSheet.tsx');
const has = (code: string, selector: string) =>
  selector.startsWith('#') ? code.includes(`id="${selector.slice(1)}"`) : code.includes(selector.slice(1));

describe('tour targets', () => {
  it('each phone step points at an element the phone layout draws', () => {
    for (const step of TOUR) expect(has(phoneSource, step.phone.target), step.phone.target).toBe(true);
  });
});
