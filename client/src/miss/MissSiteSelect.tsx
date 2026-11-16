// The Miss tab's Site dropdown (the shared Select). Picking a site sets the
// shared scenario's site, so the Console selection follows.
import { Select } from '../components/Select';
import { missSiteOptions, type SiteLike } from './siteOptions';

interface Props {
  sites: SiteLike[];
  /** The site shown; empty when it is not one of the options (no terrain view). */
  value: string;
  /** Only the sites with terrain (the no-terrain view). */
  terrainOnly?: boolean;
  onPick: (id: string) => void;
}

export function MissSiteSelect({ sites, value, terrainOnly = false, onPick }: Props) {
  const { terrain, others } = missSiteOptions(sites);
  const listed = terrainOnly ? terrain : [...terrain, ...others];
  const known = listed.some((o) => o.id === value);
  return (
    <label className="fld miss-site">
      <span>{terrainOnly ? 'SITE WITH TERRAIN' : 'SITE'}</span>
      <Select
        id="miss-site"
        width="place"
        value={known ? value : ''}
        aria-describedby="miss-site-hint"
        onChange={(e) => e.target.value && onPick(e.target.value)}
      >
        {!known && (
          <option value="" disabled>
            Choose a site with terrain
          </option>
        )}
        {terrain.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        {!terrainOnly && others.length > 0 && (
          <>
            <option disabled value="—" aria-hidden="true">
              ──────────
            </option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </>
        )}
      </Select>
      <small className="sr" id="miss-site-hint">
        Changes the site on the Console too.
      </small>
    </label>
  );
}
