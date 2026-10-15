import { z } from 'zod';

// All runtime config comes from env vars so the Docker stack and the backend + QVAC
// can run on different machines. Defaults match infra/docker-compose.yml on localhost.
// The RLN_* service addresses (indexer, bitcoind, proxy) are seen from inside the
// Docker network, because the RLN nodes resolve them, not this process.
const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const EnvSchema = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(8080),
  RLN_ALICE_URL: z.url().default('http://localhost:3001'),
  RLN_BOB_URL: z.url().default('http://localhost:3002'),
  RLN_CHARLIE_URL: z.url().default('http://localhost:3003'),
  ESPLORA_URL: z.url().default('http://localhost:3010'),

  RLN_ALICE_PASSWORD: optionalSecret,
  RLN_BOB_PASSWORD: optionalSecret,
  RLN_CHARLIE_PASSWORD: optionalSecret,
  RLN_ALICE_MNEMONIC: optionalSecret,
  RLN_BOB_MNEMONIC: optionalSecret,
  RLN_CHARLIE_MNEMONIC: optionalSecret,

  RLN_INDEXER_URL: z.string().min(1).default('electrs:50001'),
  RLN_BITCOIND_RPC_HOST: z.string().min(1).default('bitcoind'),
  RLN_BITCOIND_RPC_PORT: z.coerce.number().int().positive().default(18443),
  RLN_BITCOIND_RPC_USER: z.string().min(1).default('user'),
  RLN_BITCOIND_RPC_PASSWORD: z.string().min(1).default('password'),
  RGB_PROXY_ENDPOINT: z.string().min(1).default('rpc://proxy:3000/json-rpc'),

  DEMO_ASSET_TICKER: z.string().min(1).default('DUSD'),
  DEMO_ASSET_NAME: z.string().min(1).default('Demo Digital Dollar'),
  // Kitty (PROMPT §2): D in USD cents, and the silent-assent window for expense lines.
  POT_DEPOSIT_CENTS: z.coerce.bigint().positive().default(5000n),
  SILENT_ASSENT_SECONDS: z.coerce.number().int().positive().default(20),
  // DEV ONLY: serve dev-fakes/fake-ai.ts instead of QVAC. demo:reset refuses to run with it.
  FAKE_AI: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),
  RGB_AUTO_MINE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}
