import Fastify from 'fastify';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

await app.listen({ port: config.SERVER_PORT, host: '127.0.0.1' });
