import { z } from 'zod';

// Shared zod schemas and types for web and server. Domain schemas arrive in Phases 2–3.
export const ParticipantIdSchema = z.enum(['alice', 'bob', 'charlie']);
export type ParticipantId = z.infer<typeof ParticipantIdSchema>;
