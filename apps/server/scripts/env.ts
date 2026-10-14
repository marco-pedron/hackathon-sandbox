// Repo-root paths and .env handling for CLI scripts (Node's built-in loader, no dotenv).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const ENV_FILE = `${REPO_ROOT}.env`;
// Written by rgb:seed (gitignored via infra/data/). The asset id changes on every reset.
export const SEED_STATE_FILE = `${REPO_ROOT}infra/data/seed-state.json`;

export interface SeedState {
  assetId: string;
  ticker: string;
}

export function writeSeedState(state: SeedState): void {
  mkdirSync(`${REPO_ROOT}infra/data`, { recursive: true });
  writeFileSync(SEED_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

export function loadDotEnv(): void {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}

// Set KEY=value in .env only if the key is missing or empty. Never touches other lines.
export function setEnvIfEmpty(key: string, value: string): void {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const line = new RegExp(`^${key}=(.*)$`, 'm');
  const m = text.match(line);
  if (m && m[1]!.trim() !== '' && m[1]!.trim() !== '""') return;
  const entry = `${key}="${value}"`;
  const next = m ? text.replace(line, entry) : `${text}${text.endsWith('\n') || text === '' ? '' : '\n'}${entry}\n`;
  writeFileSync(ENV_FILE, next, { mode: 0o600 });
}
