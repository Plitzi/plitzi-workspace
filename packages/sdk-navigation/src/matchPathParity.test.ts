import { matchPath as routerMatchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { matchPath } from '@plitzi/sdk-shared/navigation/matchPath';

import type { PathPattern } from '@plitzi/sdk-shared/navigation/matchPath';

// The SDK routes in the browser and the server resolves the same URL for SSR/RSC. Both must agree, so the
// dependency-free matcher in sdk-shared is pinned here against react-router's, which is what the client router
// uses. If react-router changes its matching semantics, this fails instead of silently drifting.
const patterns: (string | PathPattern)[] = [
  '/',
  '*',
  '/*',
  '/about',
  '/About',
  '/a.b',
  '/blog/:slug',
  '/blog/:slug?',
  '/:lang/blog/:slug',
  '/files/*',
  { path: '/blog', end: false },
  { path: '/About', caseSensitive: true },
  { path: '/', end: false }
];

const pathnames = [
  '/',
  '/about',
  '/about/',
  '/About',
  '/axb',
  '/a.b',
  '/blog',
  '/blog/',
  '/blog/hello-world',
  '/blog/hello%20world',
  '/blog/100%',
  '/blog/a/b',
  '/es/blog/hola',
  '/files/a/b/c',
  '/blogging',
  '/anything/at/all'
];

describe('matchPath parity with react-router', () => {
  patterns.forEach(pattern => {
    const label = typeof pattern === 'string' ? pattern : JSON.stringify(pattern);
    pathnames.forEach(pathname => {
      it(`agrees for ${label} against ${pathname}`, () => {
        const mine = matchPath(pattern, pathname);
        const theirs = routerMatchPath(pattern, pathname);

        if (theirs === null) {
          expect(mine).toBeNull();

          return;
        }

        expect(mine).not.toBeNull();
        expect(mine?.params).toEqual(theirs.params);
        expect(mine?.pathname).toBe(theirs.pathname);
        expect(mine?.pathnameBase).toBe(theirs.pathnameBase);
      });
    });
  });
});
