// Flow 7 on screen: the public endpoints, and a place to send each one for the
// current scenario. Requests are real and count against the visitor's limit.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state';
import { tabFor } from '../tabs';
import { usePageMeta } from '../meta';
import { ENDPOINTS, endpointUrl, previewJson } from './endpoints';

const TAB = tabFor('/api')!;

interface Reply {
  url: string;
  status: number;
  remaining: string | null;
  limit: string | null;
  retryAfter: string | null;
  body: string;
}

const ERRORS: Array<[string, string, string]> = [
  ['400', 'A value is missing or out of range', 'The field name and the allowed range'],
  ['404', 'Unknown site', 'A message naming the id'],
  ['409', 'No terrain for this site (Miss and aim points)', 'A message saying which sites have terrain'],
  ['429', 'Too many requests', 'The seconds to wait'],
  ['503', 'NASA unavailable and nothing saved', 'A message; nothing is invented'],
];

export function ApiPage() {
  const { scenario, started, start, terrainSite, search } = useApp();
  const [selected, setSelected] = useState(ENDPOINTS[0]!.key);
  const [reply, setReply] = useState<Reply | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState('');

  usePageMeta(TAB.title, TAB.description, TAB.path);
  useEffect(() => {
    if (!started) start();
  }, [started, start]);

  const endpoint = ENDPOINTS.find((e) => e.key === selected) ?? ENDPOINTS[0]!;
  const url = endpointUrl(endpoint.key, scenario, terrainSite?.id);
  const absolute = `${window.location.origin}${url}`;
  const shown = reply && reply.url === url ? reply : null;

  const send = async () => {
    setSending(true);
    setFailed('');
    try {
      const res = await fetch(url, { headers: { Accept: endpoint.file ? 'text/csv' : 'application/json' } });
      const text = await res.text();
      let body = text;
      if ((res.headers.get('content-type') ?? '').includes('json')) {
        try {
          body = previewJson(JSON.parse(text));
        } catch {
          body = text;
        }
      }
      setReply({
        url,
        status: res.status,
        remaining: res.headers.get('X-RateLimit-Remaining'),
        limit: res.headers.get('X-RateLimit-Limit'),
        retryAfter: res.headers.get('Retry-After'),
        body,
      });
    } catch {
      setReply(null);
      setFailed('The request could not be sent. The Moon Status server may be unreachable.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main id="content" tabIndex={-1} className="body">
      <h1 className="sr">API</h1>

      <aside className="side api-list" aria-labelledby="ep-title">
        <h2 className="lbl" id="ep-title">
          01 / ENDPOINTS · VERSION 1
        </h2>
        {ENDPOINTS.map((e) => (
          <button
            key={e.key}
            type="button"
            className="row"
            aria-pressed={e.key === selected}
            onClick={() => setSelected(e.key)}
          >
            <span className="grow">
              <b className="mono api-path">
                {e.method} {e.path}
              </b>
              <small className="api-sum">{e.summary}</small>
            </span>
          </button>
        ))}
      </aside>

      <div className="main">
        <h2 className="lbl">02 / TRY IT · USES THE CURRENT SCENARIO · A REAL REQUEST</h2>
        <div className="pad line">
          <p>{endpoint.returns}</p>
          <p className="mono api-url">
            {endpoint.method} {absolute}
          </p>
          <p className="choices">
            <button type="button" className="btn" disabled={sending} onClick={send}>
              {sending ? 'SENDING…' : 'SEND'}
            </button>{' '}
            {endpoint.file && (
              <a className="btn2 as-button api-download" href={url} download>
                DOWNLOAD THE FILE
              </a>
            )}{' '}
            <span className="mono hint" role="status">
              {shown?.remaining != null && shown.limit != null
                ? `${shown.remaining} OF ${shown.limit} REQUESTS LEFT THIS MINUTE`
                : 'EVERY ENDPOINT IS LIMITED PER VISITOR'}
            </span>
          </p>
        </div>

        {failed && (
          <div className="ban" role="alert">
            <span>
              <b>▲ {failed}</b>
            </span>
          </div>
        )}
        {shown && shown.status === 429 && (
          <div className="ban" role="alert">
            <span>
              <b>▲ HTTP 429. Too many requests.</b> Try again in {shown.retryAfter ?? 'a few'} seconds.
            </span>
          </div>
        )}

        <h3 className="lbl">{shown ? `REPLY · HTTP ${shown.status}` : 'REPLY'}</h3>
        <pre className="api-reply" aria-live="polite" tabIndex={0}>
          {shown ? shown.body : 'Press SEND to see the reply for the current scenario.'}
        </pre>
        <p className="pad hint">
          Long lists are cut short here to keep the reply readable; the request itself returns all of
          them. Behind this, the server asks NASA Horizons for positions one request at a time and
          saves every answer, as NASA&apos;s fair-use rules require. The browser never calls NASA.
        </p>
      </div>

      <aside className="insp" aria-labelledby="err-title">
        <h2 className="lbl" id="err-title">
          03 / ERRORS
        </h2>
        <table className="t">
          <caption className="sr">Error replies</caption>
          <thead>
            <tr>
              <th scope="col">CODE</th>
              <th scope="col">WHEN</th>
              <th scope="col">YOU GET</th>
            </tr>
          </thead>
          <tbody>
            {ERRORS.map(([code, when, get]) => (
              <tr key={code}>
                <td className="mono">{code}</td>
                <td>{when}</td>
                <td>{get}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 className="lbl">04 / ASSISTANT CONNECTOR</h2>
        <div className="pad line api-connector">
          <p>
            An AI assistant can ask the same questions through a Model Context Protocol connector at
          </p>
          <p className="mono api-url">POST {window.location.origin}/mcp</p>
          <p>Six read-only tools, each a call to the endpoints on the left:</p>
          <p className="mono api-tools">
            list_sites · get_windows · compare_sites · slip_impact · miss_tolerance · change_report
          </p>
          <p className="hint">It cannot start or delete anything, and the same request limit applies.</p>
        </div>
        <h2 className="lbl">05 / GOOD TO KNOW</h2>
        <ul className="pad api-notes">
          <li>Every reply names the model it used: smooth Moon or terrain.</li>
          <li>Times are UTC. Dates run from 2020-01-01 to 2040-12-31.</li>
          <li>Version 1 only adds fields; nothing is removed or renamed.</li>
          <li>
            The same scenario is in this page&apos;s address, so a{' '}
            <Link className="inline-link" to={{ pathname: '/', search }}>
              link to the Console
            </Link>{' '}
            shows what a request returns.
          </li>
        </ul>
      </aside>
    </main>
  );
}
