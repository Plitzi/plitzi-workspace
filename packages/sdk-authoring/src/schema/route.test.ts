import { describe, expect, it } from 'vitest';

import { container } from '../elements';
import { audienceAt, pageAt } from './route';
import { authorSpace } from './space';

// The CLI matched addresses to pages with a copy of the router, and read /sign-in signed in (encore-10).
describe('which page answers an address, and for whom', () => {
  const { schema } = authorSpace({
    name: 'Routes',
    permanentUrl: 'routes',
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
      { name: 'Profile', slug: 'u/{{username}}', body: [container({ id: 'profile-box' })] },
      {
        name: 'New room',
        slug: 'rooms/new',
        body: [
          container({ id: 'new-form', visible: 'auth.isAuthenticated' }),
          container({ id: 'new-gate', visible: '!auth.isAuthenticated' })
        ]
      },
      {
        name: 'Welcome',
        id: 'welcome-out',
        slug: 'welcome',
        accessLevel: 'public',
        body: [container({ id: 'out-box' })]
      },
      {
        name: 'Welcome back',
        id: 'welcome-in',
        slug: 'welcome',
        accessLevel: 'authenticated',
        body: [container({ id: 'back-box' })]
      }
    ]
  });

  it('is the router’s own answer: a page drawn, or where the visitor is sent', () => {
    expect(pageAt(schema, '/u/mika?tab=crates')).toMatchObject({ action: 'normal' });
    expect(pageAt(schema, '/account')).toEqual({ action: 'redirect', redirect: '/sign-in' });
    expect(pageAt(schema, '/account', { signedIn: true })).toMatchObject({ action: 'normal' });
    expect(pageAt(schema, '/sign-in', { signedIn: true })).toMatchObject({ action: 'redirect' });
  });

  it('says whom it is for, asked as a guest and as a signed-in visitor', () => {
    expect(audienceAt(schema, '/')).toBe('everyone');
    expect(audienceAt(schema, '/sign-in')).toBe('guests');
    expect(audienceAt(schema, '/account')).toBe('members');
    expect(audienceAt(schema, '/welcome')).toBe('both-apart');
    expect(audienceAt(schema, '/u/juno')).toBe('everyone');
    // A gate in place: the router sends nobody away, the page draws each apart (encore-11's /rooms/new).
    expect(audienceAt(schema, '/rooms/new')).toBe('gated');
  });
});
