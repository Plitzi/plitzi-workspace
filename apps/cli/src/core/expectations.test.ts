import { describe, expect, it } from 'vitest';

import { authorSpace, container } from '@plitzi/sdk-authoring';

import { checkedPaths, fallsToNotFound, makesPageAt } from './expectations';

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

// A run's scope printed eleven "deadlocks" for lines on /pricing and /status in the very tasks whose folders made them.
describe('a task that makes the page it checks', () => {
  const folders = ['src/space/pages'];

  it('is one writing its folder, a module of it, or a module named for it', () => {
    expect(makesPageAt(['src/space/pages/pricing'], '/pricing', folders)).toBe(true);
    expect(makesPageAt(['src/space/pages/status/index.ts'], '/status/regions', folders)).toBe(true);
    expect(makesPageAt(['src/space/pages/about.ts'], '/about', folders)).toBe(true);
  });

  it('is never one writing another page, a name that only starts the same, or nothing of a page folder', () => {
    expect(makesPageAt(['src/space/pages/pricinx.ts'], '/pricing', folders)).toBe(false);
    expect(makesPageAt(['src/space/pages/pricing-old/index.ts'], '/pricing', folders)).toBe(false);
    expect(makesPageAt(['src/plugins/Pricing/index.ts'], '/pricing', folders)).toBe(false);
    expect(makesPageAt(['src/space/pages/home'], '/', folders)).toBe(false);
  });
});
