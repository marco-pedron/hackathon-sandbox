import Fastify from 'fastify';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = Fastify({ logger: true });

if (config.FAKE_AI) {
  app.log.warn(
    '\n' +
      '='.repeat(64) +
      '\n  FAKE_AI=1: receipts and splits come from dev-fakes/fake-ai.ts,\n' +
      '  NOT from the on-device model. Development only, never for the demo.\n' +
      '='.repeat(64),
  );
}

app.get('/health', async () => ({ ok: true }));

await app.listen({ port: config.SERVER_PORT, host: '127.0.0.1' });
