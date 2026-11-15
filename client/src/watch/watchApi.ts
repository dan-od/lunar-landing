// Calls to the watch endpoints. Email alerts exist only when the server says so
// (GET /v1/watches/config); everything else answers 404 when they are off.
import { ApiFailure } from '../api';

export interface WatchConfig {
  email_enabled: boolean;
  rules: Array<{ id: string; label: string }>;
  privacy: string;
}

export interface WatchEvent {
  time: string;
  level: string;
  message: string;
}

export interface WatchSummary {
  id: string;
  site: string;
  site_name: string;
  rule: string;
  rule_label: string;
  model: string;
  status: 'pending' | 'active' | 'tripped' | 'expired';
  address_masked: string;
  scenario: { date: string; hour: number; margin: number; accuracy: number; aim_east?: number; aim_north?: number };
  created_at: string;
  expires_at: string | null;
  last_checked_at: string | null;
  events: WatchEvent[];
}

export interface CreatedWatch {
  id: string;
  status: 'pending';
  manage_token: string;
  site_name: string;
  rule_label: string;
  address_masked: string;
  expires_at: string;
}

export interface WatchScenario {
  date: string;
  hour: number;
  margin: number;
  accuracy: number;
  aim_east?: number;
  aim_north?: number;
}

/** A failure that names the field at fault, so the form can put the message above it. */
export class WatchFailure extends ApiFailure {
  constructor(
    message: string,
    public readonly field: string | undefined,
    public readonly status: number,
    /** On a 502 the watch was saved but its email was not sent. */
    public readonly watch?: CreatedWatch,
  ) {
    super(status === 429 ? 'rate' : status >= 500 ? 'unavailable' : 'bad', message);
  }
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new WatchFailure('The Moon Status server could not be reached.', undefined, 0);
  }
  if (res.ok) return (await res.json()) as T;
  let message = `Request failed (HTTP ${res.status}).`;
  let field: string | undefined;
  let watch: CreatedWatch | undefined;
  try {
    const j = (await res.json()) as { error?: { message?: string; field?: string }; watch?: CreatedWatch };
    message = j.error?.message ?? message;
    field = j.error?.field;
    watch = j.watch;
  } catch {
    // Not JSON: keep the plain message.
  }
  throw new WatchFailure(message, field, res.status, watch);
}

export const getWatchConfig = () => send<WatchConfig>('GET', '/v1/watches/config');

export const createWatch = (body: Record<string, unknown>) => send<CreatedWatch>('POST', '/v1/watches', body);

export const confirmWatch = (token: string) => send<WatchSummary>('POST', '/v1/watches/confirm', { token });

export const lookupWatches = (tokens: string[]) =>
  send<{ watches: WatchSummary[] }>('POST', '/v1/watches/lookup', { manage_tokens: tokens });

export const recheckWatches = (tokens: string[], site: string, scenario: WatchScenario) =>
  send<{ watches: WatchSummary[] }>('POST', '/v1/watches/recheck', { manage_tokens: tokens, site, scenario });

export const resendWatch = (id: string, token: string) =>
  send<WatchSummary>('POST', `/v1/watches/${encodeURIComponent(id)}/resend`, { manage_token: token });

export const deleteWatch = (id: string, token: string) =>
  send<{ deleted: true }>('DELETE', `/v1/watches/${encodeURIComponent(id)}`, { manage_token: token });
