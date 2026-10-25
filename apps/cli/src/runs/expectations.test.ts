import { describe, expect, it } from 'vitest';

import { checkedPaths, fallsToNotFound } from './expectations';

import type { SpaceHandles } from '@plitzi/sdk-authoring';

const page = (id: string, path: string, slug = path.slice(1)) => ({ id, path, slug, elements: {} });
// A stand-in of the handles the space authors: only the pages are read.
const handles = {
  pages: { home: page('home', '/'), fight: page('fight', '/combate/:slug'), lost: page('lost', '/*', '*') }
} as unknown as SpaceHandles;

// The lead's acceptance `page check /no-existe` had no --status 404, and could never pass.
describe('a plan’s check of an address no page answers', () => {
  it('reads the addresses a page check asks, and whether it says a status', () => {
    expect(checkedPaths('plitzi page check /no-existe /combates --width 1440 --expect "x~y"')).toEqual([
      { paths: ['/no-existe', '/combates'], status: false }
    ]);
    expect(checkedPaths('plitzi page check /no-existe --status 404')).toEqual([
      { paths: ['/no-existe'], status: true }
    ]);
    expect(checkedPaths('npm test')).toEqual([]);
  });

  it('falls to the not-found page where no page of the space answers', () => {
    expect(fallsToNotFound(handles, '/no-existe')).toBe(true);
    expect(fallsToNotFound(handles, '/combate/la-parce')).toBe(false);
    expect(fallsToNotFound(handles, '/')).toBe(false);
  });
});
