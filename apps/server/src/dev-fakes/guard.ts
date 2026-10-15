// Fakes are for development only (CLAUDE.md). demo:reset and anything that shows the demo
// must call this first: a demo must never run on a fake AI or a fake API.
export function assertNoFakes(env: NodeJS.ProcessEnv = process.env): void {
  const on = ['FAKE_AI', 'VITE_FAKE_API'].filter((k) => env[k] === '1');
  if (on.length > 0) {
    throw new Error(`refusing to run with fakes on (${on.join(', ')}=1): unset them and retry`);
  }
}
