// Flow 2: add coordinates. An inline form in the site list, so the existing sites
// stay visible while typing. Bad values show a message above the field and focus
// returns to it (2-2). Escape or Cancel closes the form and focus goes back to
// the Add button. Behaviour and wording follow the flow prototype.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { checkCoordinates, NAME_MAX } from '../customSites';

interface Props {
  /** Why adding is not possible right now (for example NASA is down), or null. */
  disabledReason: string | null;
  onAdd: (name: string, lat: number, lon: number) => void;
}

export function AddCoordinates({ disabledReason, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [error, setError] = useState<{ field: 'lat' | 'lon'; message: string } | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lonRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (open) latRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      openRef.current?.focus();
    }
  }, [open]);

  const close = () => {
    returnFocus.current = true;
    setOpen(false);
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const check = checkCoordinates(lat, lon);
    if (!check.ok) {
      setError({ field: check.field, message: check.message });
      (check.field === 'lat' ? latRef : lonRef).current?.focus();
      return;
    }
    onAdd(name, check.lat, check.lon);
    setName('');
    setLat('');
    setLon('');
    close();
  };

  if (!open) {
    return (
      <>
        <button
          ref={openRef}
          type="button"
          className="row add-open"
          disabled={Boolean(disabledReason)}
          aria-describedby={disabledReason ? 'add-why' : undefined}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <span aria-hidden="true">＋ </span>ADD COORDINATES
        </button>
        {disabledReason && (
          <p className="pad hint line" id="add-why">
            {disabledReason}
          </p>
        )}
      </>
    );
  }

  return (
    <form
      className="pad line add-form"
      noValidate
      aria-label="Add coordinates"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <label className="fld">
        <span>NAME (OPTIONAL)</span>
        <input value={name} maxLength={NAME_MAX} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      {error?.field === 'lat' && (
        <p className="err" role="alert" id="add-lat-err">
          {error.message}
        </p>
      )}
      <label className="fld">
        <span>LATITUDE, −90 TO 90 (SOUTH IS NEGATIVE)</span>
        <input
          ref={latRef}
          value={lat}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={error?.field === 'lat' ? true : undefined}
          aria-describedby={error?.field === 'lat' ? 'add-lat-err' : undefined}
          onChange={(e) => setLat(e.target.value)}
        />
      </label>
      {error?.field === 'lon' && (
        <p className="err" role="alert" id="add-lon-err">
          {error.message}
        </p>
      )}
      <label className="fld">
        <span>LONGITUDE, −180 TO 360 (EAST IS POSITIVE)</span>
        <input
          ref={lonRef}
          value={lon}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={error?.field === 'lon' ? true : undefined}
          aria-describedby={error?.field === 'lon' ? 'add-lon-err' : undefined}
          onChange={(e) => setLon(e.target.value)}
        />
      </label>
      <p className="hint add-note">
        Positions come from NASA for the next 30 days. A visitor can add a few new places an hour. The
        name stays in this browser only.
      </p>
      <div className="add-actions">
        <button type="submit" className="btn">
          ADD SITE
        </button>
        <button type="button" className="btn2" onClick={close}>
          CANCEL
        </button>
      </div>
    </form>
  );
}
