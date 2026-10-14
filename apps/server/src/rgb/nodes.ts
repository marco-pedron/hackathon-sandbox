import { createRlnClient, type RlnClient } from '@settleup/rgb-client';
import type { Config } from '../config.js';
import { toRlnError } from './errors.js';

export const PARTICIPANTS = ['alice', 'bob', 'charlie'] as const;
export type Participant = (typeof PARTICIPANTS)[number];

// One RLN node per participant. In production each user runs their own node; for the
// demo one backend drives all three (see README).
export interface RlnNode {
  name: Participant;
  client: RlnClient;
  password: string | undefined;
  mnemonic: string | undefined;
}

export function rlnNodes(cfg: Config): Record<Participant, RlnNode> {
  const node = (name: Participant, url: string, password?: string, mnemonic?: string): RlnNode => ({
    name,
    client: createRlnClient(url),
    password,
    mnemonic,
  });
  return {
    alice: node('alice', cfg.RLN_ALICE_URL, cfg.RLN_ALICE_PASSWORD, cfg.RLN_ALICE_MNEMONIC),
    bob: node('bob', cfg.RLN_BOB_URL, cfg.RLN_BOB_PASSWORD, cfg.RLN_BOB_MNEMONIC),
    charlie: node('charlie', cfg.RLN_CHARLIE_URL, cfg.RLN_CHARLIE_PASSWORD, cfg.RLN_CHARLIE_MNEMONIC),
  };
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

// Unwrap an openapi-fetch result: return data, or throw an RlnError with the node's name.
export async function rln<T>(node: RlnNode, endpoint: string, call: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) throw toRlnError(node.name, endpoint, response.status, error);
  return data as T;
}
