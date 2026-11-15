// "How we know it's right": the checks behind the numbers, in plain words. The
// Apollo 11 line is computed live by the same calculator (GET /v1/sky) and set
// beside a figure NASA published, with its source.
import { useEffect, useState } from 'react';

/** Apollo 11 touchdown, 1969-07-20 20:17:39 UTC (NASA SP-2000-4029). */
const APOLLO_DATE = '1969-07-20';
const PUBLISHED = {
  deg: 10.8,
  title: 'Apollo by the Numbers (NASA SP-2000-4029), table "LM Lunar Landing", row "Sun Angle"',
  url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-27_LM_Lunar_Landing.htm',
};

interface Sky {
  sun: { elevation_deg: number; azimuth_deg: number };
}

async function sunAt(hour: number): Promise<Sky> {
  const res = await fetch(`/v1/sky?site=ap11&date=${APOLLO_DATE}&hour=${hour}&margin=0`);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Sky;
}

export function HowWeKnow() {
  const [apollo, setApollo] = useState<{ at20: number; at21: number; az: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([sunAt(20), sunAt(21)])
      .then(([a, b]) => setApollo({ at20: a.sun.elevation_deg, at21: b.sun.elevation_deg, az: a.sun.azimuth_deg }))
      .catch(() => setFailed(true));
  }, []);

  // Positions are hourly; 20:17 sits 17 minutes into the hour, so read between the two.
  const at2017 = apollo ? apollo.at20 + (17 / 60) * (apollo.at21 - apollo.at20) : null;

  return (
    <section aria-labelledby="right" className="right-panel">
      <h2 className="lbl" id="right" tabIndex={-1}>
        06 / HOW WE KNOW IT&apos;S RIGHT
      </h2>
      <dl className="pad help-terms">
        <div>
          <dt>NASA positions, checked against NASA</dt>
          <dd>
            Every Sun and Earth position comes from NASA JPL Horizons. Tests run on saved Horizons replies
            and require exact results (on one, the Sun is up 86% of the time at a 2° allowance). A live check
            matched the stored values to a fresh Horizons request to the sixth decimal place at three times.
          </dd>
        </div>
        <div>
          <dt>Directions agree with the terrain</dt>
          <dd>
            Horizons and the terrain profiles must both measure direction clockwise from north. We checked
            this from the elevation map&apos;s own projection (worst error 0.004° around the full circle).
            Example: at 2025-03-06 08:00 UTC Horizons puts the Sun 70.5° from north and 2.07° up, and the
            terrain in that direction stands 1.23° high, so the target is lit.
          </dd>
        </div>
        <div>
          <dt>The 2025 IM-2 landing</dt>
          <dd>
            At the target at 2025-03-06 00:00 UTC the Sun is 1.7° up, under the 2° allowance, so it reads
            No power; by 17:00 it reads Ready. The real lander came down about 250 m away in a crater and
            lost power. Our terrain map, at 80 m per pixel, is too coarse to show that crater, and we say
            so instead of tuning numbers to match.
          </dd>
        </div>
        <div>
          <dt>Apollo 11, 1969-07-20 20:17 UTC</dt>
          <dd>
            {at2017 !== null && apollo ? (
              <>
                Our Sun height at Tranquility Base: <b className="mono c-sun">{at2017.toFixed(1)}°</b>, read
                between {apollo.at20.toFixed(2)}° at 20:00 and {apollo.at21.toFixed(2)}° at 21:00 (NASA
                positions are hourly), toward {apollo.az.toFixed(1)}° from north.{' '}
              </>
            ) : failed ? (
              'Our value could not be loaded just now. '
            ) : (
              'Loading our value… '
            )}
            NASA published a Sun angle of <b className="mono">{PUBLISHED.deg.toFixed(1)}°</b> for the
            landing in{' '}
            <a href={PUBLISHED.url} target="_blank" rel="noreferrer">
              {PUBLISHED.title}
              <span className="sr"> (opens in a new tab)</span>
            </a>
            . That book also lists 10.8° as the planned angle, so it may be the target rather than a
            measurement.
          </dd>
        </div>
      </dl>
    </section>
  );
}
