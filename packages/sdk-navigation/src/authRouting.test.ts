import { describe, expect, it } from 'vitest';

import { getPaths, matchRoutePath } from './NavigationHelper';

import type { Element } from '@plitzi/sdk-shared';

/**
 * Two pages on one path, told apart by `accessLevel`: the way a space offers a sign-in page and the page behind it
 * without writing a condition into either. Signing in has to change which one renders, on the server and in the
 * browser alike, so this pins the rule both sides evaluate.
 */

const page = (id: string, accessLevel?: string): Element => ({
  id,
  attributes: { slug: '', name: id, ...(accessLevel ? { accessLevel } : {}) },
  definition: { label: id, type: 'page', rootId: id, styleSelectors: { base: '' } }
});

const pick = (pages: Record<string, Element>, authenticated: boolean) =>
  matchRoutePath(getPaths(pages, [], authenticated, '', true), '/', authenticated).pageId;

describe('two pages sharing a path', () => {
  const pages = { guest: page('guest', 'public'), member: page('member', 'authenticated') };

  it('shows the public one to a visitor who is not signed in', () => {
    expect(pick(pages, false)).toBe('guest');
  });

  it('shows the other one the moment they are', () => {
    expect(pick(pages, true)).toBe('member');
  });
});

/**
 * The trap: a page with NO `accessLevel` is authored for everybody, so it matches whether or not anyone is signed in
 * — and on a shared path it competes with both of the above. Which one answers then comes down to sort order, so a
 * space must not put an unrestricted page on the same path as an access-controlled pair.
 */
describe('an unrestricted page on the same path', () => {
  const pages = {
    guest: page('guest', 'public'),
    member: page('member', 'authenticated'),
    anyone: page('anyone')
  };

  it('is a candidate in both states, which is what makes the choice ambiguous', () => {
    const forGuest = getPaths(pages, [], false, '', true).filter(path => path.hasAccess);
    const forMember = getPaths(pages, [], true, '', true).filter(path => path.hasAccess);

    expect(forGuest.map(path => path.pageId)).toContain('anyone');
    expect(forMember.map(path => path.pageId)).toContain('anyone');
  });
});
