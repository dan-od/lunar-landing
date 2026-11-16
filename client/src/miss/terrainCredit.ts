// Plain words for which map produced a site's terrain, named in the Miss tab
// footer. Every reply and file names the model and its map (a project rule).
import type { TerrainStatusReply } from '../api';

/** "terrain from LOLA 120 m" — the resolution, rounded to whole metres. */
export function mapCredit(resolutionM: number | null | undefined): string {
  if (!resolutionM) return 'terrain from the LOLA elevation map';
  return `terrain from LOLA ${Math.round(resolutionM)} m`;
}

/** The whole-Moon map is far coarser than the polar maps; say so plainly. */
export function isCoarse(resolutionM: number | null | undefined): boolean {
  return (resolutionM ?? 0) >= 200;
}

export function coarseNote(resolutionM: number | null | undefined): string | null {
  if (!isCoarse(resolutionM)) return null;
  return `This is the whole-Moon map at about ${Math.round(resolutionM!)} m per pixel, coarser than the polar maps; craters smaller than that are not seen.`;
}

/** The short line shown while terrain is being prepared. */
export function preparingText(status: TerrainStatusReply | null): string {
  if (status?.map) return `Preparing terrain from LOLA ${status.map}…`;
  return 'Preparing terrain…';
}
