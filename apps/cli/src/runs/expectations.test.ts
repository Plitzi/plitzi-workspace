import { describe, expect, it } from 'vitest';

import { authorSpace, container } from '@plitzi/sdk-authoring';

import { checkedPaths, fallsToNotFound } from './expectations';

const authored = authorSpace({
  name: 'Fights',
  permanentUrl: 'fights',
  pages: [
    { name: 'Home', slug: '', isDefault: true, body: [container({ id: 'home-box' })] },
    { name: 'Fight', slug: 'combate/{{slug}}', body: [container({ id: 'fight-box' })] },
    { name: 'Lost', slug: '*', body: [container({ id: 'lost-box' })] }
  ]
});

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
    expect(fallsToNotFound(authored, '/no-existe')).toBe(true);
    expect(fallsToNotFound(authored, '/combate/la-parce')).toBe(false);
    expect(fallsToNotFound(authored, '/')).toBe(false);
  });
});
