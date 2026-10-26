import { describe, expect, it } from 'vitest';

import { returnTo, withRedirect } from './redirects';

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
