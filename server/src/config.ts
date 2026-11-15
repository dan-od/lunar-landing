// Central place for server settings. Values come from the environment; no
// secrets or real values live in the repository (see AGENTS.md, S-1).
import 'dotenv/config';

export interface Config {
  port: number;
  nodeEnv: string;
  horizonsApiUrl: string;
  horizonsTimeoutMs: number;
  horizonsMaxRetries: number;
  horizonsRetryBaseMs: number;
  publicSiteUrl: string;
  rateLimitPerMinute: number;
  customSitesPerHour: number;
  trustProxy: string;
  /** Key for the email service (Resend). A deployment secret; empty when not set. */
  emailSendingKey: string;
  /** Keys the stored hashes of watch tokens. A deployment secret; empty when not set. */
  tokenSigningSecret: string;
  /** The From line of alert emails. */
  emailFrom: string;
  /** New watches one visitor may start per hour. */
  watchesPerHour: number;
  /** All watch data is removed once the UTC date is past this (30 days after the event, P-2). */
  watchDataDeleteAfter: string;
  /** "fake" swaps in a sender that sends nothing and logs the links. Ignored in production. */
  emailSender: string;
}

const DEFAULT_DELETE_AFTER = '2026-12-15';
const deleteAfter = process.env.WATCH_DATA_DELETE_AFTER ?? DEFAULT_DELETE_AFTER;

export const config: Config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  horizonsApiUrl:
    process.env.HORIZONS_API_URL ?? 'https://ssd.jpl.nasa.gov/api/horizons.api',
  horizonsTimeoutMs: Number(process.env.HORIZONS_TIMEOUT_MS ?? 30_000),
  horizonsMaxRetries: Number(process.env.HORIZONS_MAX_RETRIES ?? 3),
  horizonsRetryBaseMs: Number(process.env.HORIZONS_RETRY_BASE_MS ?? 1_000),
  publicSiteUrl: process.env.PUBLIC_SITE_URL ?? 'http://localhost:8080',
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
  customSitesPerHour: Number(process.env.CUSTOM_SITES_PER_HOUR ?? 5),
  trustProxy: process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal',
  emailSendingKey: process.env.EMAIL_SENDING_KEY ?? '',
  tokenSigningSecret: process.env.TOKEN_SIGNING_SECRET ?? '',
  emailFrom: process.env.EMAIL_FROM || 'Moon Status <moon@okoro.me>',
  watchesPerHour: Number(process.env.WATCHES_PER_HOUR || 5),
  // A date that cannot be read falls back to the default, so data is never kept for longer by mistake.
  watchDataDeleteAfter: /^\d{4}-\d{2}-\d{2}$/.test(deleteAfter) ? deleteAfter : DEFAULT_DELETE_AFTER,
  emailSender: process.env.EMAIL_SENDER ?? '',
};

/**
 * Whether email alerts are on, and with which sender.
 *  - "resend": the email key, the signing secret and a database are all present.
 *  - "fake": development only (EMAIL_SENDER=fake, not production), with the
 *    signing secret and a database; nothing is sent, the links are logged.
 *  - "off": anything else. The watch endpoints answer 404 and no daily check runs.
 */
export function watchMode(
  c: Pick<Config, 'emailSendingKey' | 'tokenSigningSecret' | 'emailSender' | 'nodeEnv'>,
  hasDatabase: boolean,
): 'off' | 'resend' | 'fake' {
  if (!hasDatabase || !c.tokenSigningSecret) return 'off';
  if (c.emailSender === 'fake' && c.nodeEnv !== 'production') return 'fake';
  return c.emailSendingKey ? 'resend' : 'off';
}
