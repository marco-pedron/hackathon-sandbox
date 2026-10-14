import { z } from 'zod';

// All runtime config comes from env vars so the Docker stack and the backend + QVAC
// can run on different machines. Defaults match infra/docker-compose.yml on localhost.
const EnvSchema = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(8080),
  RLN_GIULIA_URL: z.url().default('http://localhost:3001'),
  RLN_BEN_URL: z.url().default('http://localhost:3002'),
  RLN_SAM_URL: z.url().default('http://localhost:3003'),
  ESPLORA_URL: z.url().default('http://localhost:3010'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}
