// Plain words for which map produced a site's terrain, named in the Miss tab
// footer. Every reply and file names the model and its map (a project rule).
import type { TerrainStatusReply } from '../api';

/** A human name for each catalogue map. */
function mapName(map: string | null | undefined): string {
  switch (map) {
    case 'LDEM_80S_80MPP':
      return 'LOLA south polar map';
    case 'LDEM_60S_120M':
      return 'LOLA south polar map';
    case 'LDEM_60N_120M':
      return 'LOLA north polar map';
    case 'LDEM_128':
      return 'LOLA global map';
    default:
      return 'LOLA elevation map';
  }
}

/** The whole-Moon map is far coarser than the polar maps; say so plainly. */
export function isCoarse(resolutionM: number | null | undefined): boolean {
  return (resolutionM ?? 0) >= 200;
}

/**
 * "Terrain from LOLA global map, about 240 m: small craters are not seen" — the
 * map, its resolution, and (for the coarse global map) what that costs.
 */
export function mapCredit(map: string | null | undefined, resolutionM: number | null | undefined): string {
  if (!resolutionM) return 'Terrain from the LOLA elevation map.';
  const name = mapName(map);
  if (isCoarse(resolutionM)) {
    return `Terrain from ${name}, about ${Math.round(resolutionM / 10) * 10} m: small craters are not seen.`;
  }
  return `Terrain from ${name}, ${Math.round(resolutionM)} m.`;
}

/** The short line shown while terrain is being prepared. */
export function preparingText(status: TerrainStatusReply | null): string {
  if (status?.map) return `Preparing ${mapName(status.map).toLowerCase()} terrain…`;
  return 'Preparing terrain…';
}
