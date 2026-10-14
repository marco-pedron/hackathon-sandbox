import { describe, expect, it } from 'vitest';
import { ParticipantIdSchema } from './index.js';

describe('ParticipantIdSchema', () => {
  it('accepts known participants and rejects others', () => {
    expect(ParticipantIdSchema.parse('bob')).toBe('bob');
    expect(ParticipantIdSchema.safeParse('mallory').success).toBe(false);
  });
});
