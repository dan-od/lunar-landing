// Rule B for every dropdown: only the shared Select component may render a
// <select>, so no dropdown can miss our chevron, padding and width cap.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx$/.test(name) ? [p] : [];
  });
}

describe('every dropdown uses the shared Select (rule B)', () => {
  it('has no plain <select> outside components/Select.tsx', () => {
    const offenders = files(SRC)
      .filter((f) => !f.endsWith(join('components', 'Select.tsx')))
      .filter((f) => /<select[\s>]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
