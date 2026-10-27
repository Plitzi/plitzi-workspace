import { describe, expect, it } from 'vitest';

import { pathGroups } from './lookPaths';

// A run's designer looked at /moderation as a non-moderator (403) and /withheld as juno in two looks, each saying
// the other path was not looked at.
describe('the paths of one look', () => {
  it('each say who reads it and what it is sent with, looked at together when they say the same', () => {
    expect(pathGroups(['/moderation --as juno --status 403', '/withheld --as juno', '/', '/rooms'])).toEqual([
      { paths: ['/moderation'], visitor: { as: 'juno', status: 403 } },
      { paths: ['/withheld'], visitor: { as: 'juno' } },
      { paths: ['/', '/rooms'], visitor: {} }
    ]);
    expect(pathGroups(['/sign-in --guest', '/sign-up --guest'])).toEqual([
      { paths: ['/sign-in', '/sign-up'], visitor: { guest: true } }
    ]);
  });

  it('refuses a flag a path does not take, and a visitor said two ways', () => {
    expect(() => pathGroups(['/ --click hero'])).toThrow('a path says only who reads it');
    expect(() => pathGroups(['/ --as juno --guest'])).toThrow('--as or --guest, not both');
  });
});
