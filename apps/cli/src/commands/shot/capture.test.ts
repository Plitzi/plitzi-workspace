import { describe, expect, it } from 'vitest';

import { awaited, readPage, standIn, targetOn } from './capture';

import type { BrowserPage } from '../../browser';

/** A page whose reads fail as a reload's do, `times` times, then answer. */
const reloading = (times: number): Pick<BrowserPage, 'evaluate' | 'waitForLoadState' | 'url'> & { loads: number } => {
  let left = times;
  const page = {
    loads: 0,
    url: () => 'http://127.0.0.1:8300/',
    waitForLoadState: () => {
      page.loads += 1;

      return Promise.resolve();
    },
    evaluate: <R, A>(read: (input: A) => R | Promise<R>, input: A): Promise<R> => {
      if (left > 0) {
        left -= 1;

        return Promise.reject(
          new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation')
        );
      }

      return Promise.resolve(read(input));
    }
  };

  return page;
};

// A run's preview reloads at each approval, and `page shot --compare` died reading it.
describe('reading a page that reloads under it', () => {
  it('reads it again once it has loaded', async () => {
    const page = reloading(1);
    expect(await readPage(page, (n: number) => n * 2, 21)).toBe(42);
    expect(page.loads).toBe(1);
  });

  it('refuses, saying why, a page that keeps reloading', async () => {
    await expect(readPage(reloading(2), (n: number) => n, 1)).rejects.toThrow(
      'The page kept reloading while it was read'
    );
  });
});

/** A page that has exactly `present`'s selectors. */
const having = (...present: string[]) => ({
  locator: (selector: string) => ({
    first: () => ({ count: () => Promise.resolve(present.includes(selector) ? 1 : 0) })
  })
});

// The report named `section#home-sponsors` (its element's name, not an id), and `--scroll-to` said it was
// not on the page; `--clip combates`, an anchor's id, the same.
describe('finding what a picture is aimed at', () => {
  it('finds a section as a comparison names it: by its id, or by its element’s name', async () => {
    expect(await targetOn(having('section#home-sponsors'), 'section#home-sponsors')).toEqual({
      selector: 'section#home-sponsors',
      found: true
    });
    expect(await targetOn(having('section[data-plitzi-el="home-sponsors"]'), 'section#home-sponsors')).toEqual({
      selector: 'section[data-plitzi-el="home-sponsors"]',
      found: true
    });
    expect(awaited('section#home-sponsors')).toBe('section#home-sponsors, section[data-plitzi-el="home-sponsors"]');
  });

  // encore-10's designer could not read the card a step added to a list: a bare name read the first row's.
  it('finds a list row’s element by its place, or the last', async () => {
    expect(await targetOn(having('[data-plitzi-el="room-card-name"] >> nth=-1'), 'room-card-name:last')).toEqual({
      selector: '[data-plitzi-el="room-card-name"] >> nth=-1',
      found: true
    });
    expect(await targetOn(having('[data-plitzi-el="room-card-name"] >> nth=1'), 'room-card-name:2')).toEqual({
      selector: '[data-plitzi-el="room-card-name"] >> nth=1',
      found: true
    });
  });

  // Four copies of one heading were one region's name; the second's change pictured the first.
  it('finds a copy of a component’s part by its place, as a comparison numbers it', async () => {
    expect(
      await targetOn(having('header[data-plitzi-el="match-heading-root"] >> nth=1'), 'header#match-heading-root:2')
    ).toEqual({ selector: 'header[data-plitzi-el="match-heading-root"] >> nth=1', found: true });
    expect(awaited('header#match-heading-root:2')).toBe(
      'header#match-heading-root, header[data-plitzi-el="match-heading-root"]'
    );
  });

  // A run's lead: "fights-heading" — a component's instance, which has no node of its own — was "No element".
  it('finds a component’s instance by its name, on the root it is drawn as', async () => {
    expect(await targetOn(having('[data-plitzi-instance="fights-heading"]'), 'fights-heading')).toEqual({
      selector: '[data-plitzi-instance="fights-heading"]',
      found: true
    });
  });

  // `product-dot:nth-child(3)` was "not on the page" — 16 checks of one task failed on it.
  it('finds a name with a pseudo-class, an attribute or a class on it as that element — a tag stays a tag', async () => {
    const third = '[data-plitzi-el="product-dot"]:nth-child(3)';
    expect(await targetOn(having(third), 'product-dot:nth-child(3)')).toEqual({ selector: third, found: true });
    expect(await targetOn(having(`${third} button`), 'product-dot:nth-child(3) button')).toEqual({
      selector: `${third} button`,
      found: true
    });
    expect(await targetOn(having('[data-plitzi-el="tab"][aria-selected]'), 'tab[aria-selected]')).toEqual({
      selector: '[data-plitzi-el="tab"][aria-selected]',
      found: true
    });
    expect(await targetOn(having('li:nth-child(3)'), 'li:nth-child(3)')).toEqual({
      selector: 'li:nth-child(3)',
      found: true
    });
  });

  it('finds a bare word as an element’s name, a tag, or an id — never an id CSS cannot read', async () => {
    expect(await targetOn(having('#combates'), 'combates')).toEqual({ selector: '#combates', found: true });
    expect(await targetOn(having(), 'combates')).toEqual({ selector: '[data-plitzi-el="combates"]', found: false });
    // A component's instance was waited for by no selector that finds it, and the clip said "not on".
    expect(awaited('combates')).toBe(
      '[data-plitzi-el="combates"], combates, #combates, [data-plitzi-instance="combates"]'
    );
    expect(awaited('404')).toBe('[data-plitzi-el="404"], 404, [data-plitzi-instance="404"]');
  });
});

describe('another site’s pictures, stood in for beside the run before', () => {
  it('gives one picture one colour, and another picture another', () => {
    const hero = 'https://cdn.example.com/hero.webp';
    expect(standIn(hero)).toBe(standIn(hero));
    expect(standIn(hero)).not.toBe(standIn('https://cdn.example.com/footer.webp'));
    expect(standIn(hero)).toMatch(/^<svg [^>]*width="64" height="64"/);
  });
});
