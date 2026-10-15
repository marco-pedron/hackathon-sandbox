import { z } from 'zod';

// Shared zod schemas and types for web and server.
export const ParticipantIdSchema = z.enum(['alice', 'bob', 'charlie']);
export type ParticipantId = z.infer<typeof ParticipantIdSchema>;

export * from './ledger.js';
