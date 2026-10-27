import { describe, expect, it } from 'vitest';

import { authorSpace, container } from '@plitzi/sdk-authoring';

import { readsAsMember } from './visit';

// A run's designer: page measure read a guest's room where task look read the account's — one element drawn in one
// and not the other. Every page command reads a page by one rule: the space's.
describe('a page every page command reads signed in', () => {
  const authored = authorSpace({
    name: 'Rooms',
    permanentUrl: 'rooms',
    pages: [
      { name: 'Home', slug: '', isDefault: true, body: [container({ id: 'home-box' })] },
      {
        name: 'Sign in',
        slug: 'sign-in',
        accessLevel: 'public',
        unauthorizedRedirect: '',
        body: [container({ id: 'in-box' })]
      },
      {
        name: 'Account',
        slug: 'account',
        accessLevel: 'authenticated',
        unauthorizedRedirect: 'sign-in',
        body: [container({ id: 'account-box' })]
      },
      {
        name: 'Room',
        slug: 'r/{{room}}',
        body: [
          container({ id: 'room-remind', visible: 'auth.isAuthenticated' }),
          container({ id: 'room-sign-in', visible: '!auth.isAuthenticated' })
        ]
      }
    ]
  });

  it('is one only members open, or one a gate draws apart for them — never one for everyone, or for guests', () => {
    expect(readsAsMember(authored, '/account')).toBe(true);
    expect(readsAsMember(authored, '/r/night-drive')).toBe(true);
    expect(readsAsMember(authored, '/')).toBe(false);
    expect(readsAsMember(authored, '/sign-in')).toBe(false);
  });
});
