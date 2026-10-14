import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

// Typed client for one rgb-lightning-node REST API, generated from openapi.yaml
// (identical to RGB-Tools/rgb-lightning-node@d4762ac). Regenerate with `pnpm rgb:gen`.
export type RlnPaths = paths;

export function createRlnClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type RlnClient = ReturnType<typeof createRlnClient>;
