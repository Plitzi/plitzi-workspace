import { describe, expect, it } from 'vitest';

import { refusedWhy } from './inspect';

// encore-2: the admin read "/moderation was sent with status 403", and its developer looked for a password that was there.
describe('a page that refused who read it', () => {
  it('says the account signed in and was refused, or that the page is for signed-in visitors — nothing for another status', () => {
    expect(refusedWhy(403, 'dax')).toContain("signed in as dax, and the page's access refuses it");
    expect(refusedWhy(401, undefined)).toContain('check it signed in (--as <account>)');
    expect(refusedWhy(500, 'dax')).toBe('');
  });
});
