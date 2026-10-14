import { describe, expect, it } from 'vitest';
import { ParticipantIdSchema } from './index.js';

describe('ParticipantIdSchema', () => {
  it('accepts known participants and rejects others', () => {
    expect(ParticipantIdSchema.parse('ben')).toBe('ben');
    expect(ParticipantIdSchema.safeParse('mallory').success).toBe(false);
  });
});
