import { describe, expect, it } from 'vitest';

import { authorSpace } from './index';

import type { SpaceSpec } from './index';

/**
 * The page a space draws where a page is withheld from its visitor — its own look for a 401 or a 403 instead of the
 * platform's few words. One a visitor would be withheld from too draws nothing, so authoring refuses it.
 */

const space = (withheldPage: string): SpaceSpec => ({
  name: 'Fieldnotes',
  permanentUrl: 'fieldnotes',
  settings: { withheldPage },
  pages: [
    { id: 'home', name: 'Home', slug: '', body: [] },
    { id: 'notes', name: 'Notes', slug: 'notes', access: { permissions: ['notesRead'] }, body: [] },
    { id: 'noAccess', name: 'No access', slug: 'no-access', body: [] }
  ]
});

describe('authorSpace / withheldPage', () => {
  it('writes the page it names, by its id or its slug, as its id', () => {
    expect(authorSpace(space('noAccess')).schema.settings.withheldPage).toBe('noAccess');
    expect(authorSpace(space('no-access')).schema.settings.withheldPage).toBe('noAccess');
  });

  it('refuses a page the space has not, and one withheld itself', () => {
    expect(() => authorSpace(space('forbidden'))).toThrow(/no page of this space/u);
    expect(() => authorSpace(space('notes'))).toThrow(/an access of its own/u);
  });
});
