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
}

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
};
