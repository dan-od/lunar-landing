// Where a point on the Miss map sits, in plain words, beside its coordinates.
import type { Aim } from '@moon/core';

/** "40 m east, 120 m south of the target", or "the original target". */
export function offsetWords(p: Aim): string {
  const e = Math.round(p.east);
  const n = Math.round(p.north);
  if (e === 0 && n === 0) return 'the original target';
  const parts: string[] = [];
  if (e !== 0) parts.push(`${Math.abs(e)} m ${e > 0 ? 'east' : 'west'}`);
  if (n !== 0) parts.push(`${Math.abs(n)} m ${n > 0 ? 'north' : 'south'}`);
  return `${parts.join(', ')} of the target`;
}
