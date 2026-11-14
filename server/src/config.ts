// Central place for server settings. Values come from the environment; no
// secrets or real values live in the repository (see AGENTS.md, S-1).
import 'dotenv/config';

export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string | undefined;
  horizonsApiUrl: string;
  publicSiteUrl: string;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  horizonsApiUrl:
    process.env.HORIZONS_API_URL ?? 'https://ssd.jpl.nasa.gov/api/horizons.api',
  publicSiteUrl: process.env.PUBLIC_SITE_URL ?? 'http://localhost:8080',
};
