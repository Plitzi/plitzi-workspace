import { describe, expect, it } from 'vitest';

import { offSiteTarget, returnTo, withRedirect } from './redirects';

const at = (href: string): Location => {
  const url = new URL(href);

  // The parts of a Location the redirects read; the rest (assign, reload…) is a browser's and never called here.
  return {
    href,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search
  } as Location;
};

// encore-10: signing in on /sign-in?next=/rooms sent the visitor home — the page's rule fired as the login succeeded.
describe('a visitor signed in on a page for signed-out visitors', () => {
  it('goes back to the redirect its address carries, as withRedirect gave it', () => {
    const sent = withRedirect('/sign-in', 'https://encore.plitzi.app/rooms?x=1#live');
    expect(returnTo(at(`https://encore.plitzi.app${sent}`))).toBe('/rooms?x=1#live');
    expect(returnTo(at('https://encore.plitzi.app/sign-in?redirect=%2Frooms'))).toBe('/rooms');
  });

  it('never leaves the site for it, and has no answer without one', () => {
    expect(returnTo(at('https://encore.plitzi.app/sign-in?redirect=https%3A%2F%2Fevil.example%2F'))).toBeUndefined();
    expect(returnTo(at('https://encore.plitzi.app/sign-in?redirect=%2F%2Fevil.example%2F'))).toBeUndefined();
    expect(returnTo(at('https://encore.plitzi.app/sign-in'))).toBeUndefined();
  });
});

// A signed-in visitor sent by an app to the shared sign-in was sent on with the sign-in's own address: the app was lost.
describe('an off-site redirect', () => {
  const vet = 'https://api.plitzi.com/auth/continue?fallback=https%3A%2F%2Fauth.plitzi.com%2Faccount';

  it('carries where a signed-in visitor was going, from the address of the page they are sent off', () => {
    expect(offSiteTarget(vet, at('https://auth.plitzi.com/?redirect=https%3A%2F%2Fapp.plitzi.com%2F'), true)).toBe(
      `${vet}&redirect=https%3A%2F%2Fapp.plitzi.com%2F`
    );
    expect(offSiteTarget(vet, at('https://auth.plitzi.com/'), true)).toBe(vet);
  });

  it('carries the page a visitor sent to sign in asked for, and keeps a redirect the space wrote', () => {
    expect(offSiteTarget('https://auth.plitzi.com/', at('https://encore.plitzi.app/rooms?x=1'), false)).toBe(
      'https://auth.plitzi.com/?redirect=https%3A%2F%2Fencore.plitzi.app%2Frooms%3Fx%3D1'
    );
    expect(
      offSiteTarget('https://auth.plitzi.com/?redirect=%2Fhome', at('https://encore.plitzi.app/rooms'), false)
    ).toBe('https://auth.plitzi.com/?redirect=%2Fhome');
  });
});
