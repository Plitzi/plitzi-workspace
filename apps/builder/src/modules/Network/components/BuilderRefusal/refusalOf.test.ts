import { describe, expect, it } from 'vitest';

import { refusalOf } from './refusalOf';

describe('why the builder could not open its space', () => {
  it('reads a session that ended, or a credential refused, as "sign in again"', () => {
    expect(refusalOf(Object.assign(new Error('Unauthorized'), { statusCode: 401 })).kind).toBe('signedOut');
    expect(refusalOf(new Error('Authentication required')).kind).toBe('signedOut');
  });

  it('reads a space out of reach as not one the person can open', () => {
    expect(refusalOf('Space Not Found').kind).toBe('notFound');
  });

  it('reads no answer at all as the platform being unreachable, and anything else with what the server said', () => {
    expect(refusalOf(new Error('Failed to fetch')).kind).toBe('unreachable');
    expect(refusalOf(new Error('boom'))).toMatchObject({ kind: 'other', description: 'The server said: boom' });
  });
});
