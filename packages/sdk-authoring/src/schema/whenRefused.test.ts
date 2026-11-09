import { describe, expect, it } from 'vitest';

import { authorSpace } from './index';

import type { PageSpec, SpaceSpec } from './index';

/**
 * What a page answers whoever it is not for: its refusal unless it says otherwise, and `'notFound'` — as if it did not
 * exist, the space's 404 — for a page whose existence is not theirs to know (a back-office).
 */

const space = (staff: Partial<PageSpec>): SpaceSpec => ({
  name: 'Fieldnotes',
  permanentUrl: 'fieldnotes',
  pages: [
    { id: 'home', name: 'Home', slug: '', body: [] },
    { id: 'staff', name: 'Staff', slug: 'staff', body: [], ...staff }
  ]
});

describe('authorSpace / whenRefused', () => {
  it('writes notFound as the page’s unauthorized behaviour, for some permissions or a session', () => {
    const forPermissions = authorSpace(space({ access: { permissions: ['adminManage'] }, whenRefused: 'notFound' }));
    const forSession = authorSpace(space({ accessLevel: 'authenticated', whenRefused: 'notFound' }));

    expect(forPermissions.schema.flat.staff.attributes.unauthorizedBehaviour).toBe('notFound');
    expect(forSession.schema.flat.staff.attributes.unauthorizedBehaviour).toBe('notFound');
  });

  it('leaves the refusal as it was when it says so, or says nothing', () => {
    const refusal = authorSpace(space({ access: { permissions: ['adminManage'] }, whenRefused: 'refusal' }));

    expect(refusal.schema.flat.staff.attributes.unauthorizedBehaviour).toBeUndefined();
  });

  it('refuses it beside a redirect, and on a page nobody is refused', () => {
    expect(() =>
      authorSpace(space({ accessLevel: 'authenticated', whenRefused: 'notFound', unauthorizedRedirect: '' }))
    ).toThrow(/either sent on or answered as if it did not exist/u);
    expect(() => authorSpace(space({ whenRefused: 'notFound' }))).toThrow(/nobody is refused it/u);
  });
});
