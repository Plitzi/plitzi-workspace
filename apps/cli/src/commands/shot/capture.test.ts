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

// velada-dress: a run's preview reloads at each approval, and `page shot --compare` died reading it.
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

// velada-polish: the report named `section#home-sponsors` (its element's name, not an id), and `--scroll-to` said it was
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

  it('finds a bare word as an element’s name, a tag, or an id — never an id CSS cannot read', async () => {
    expect(await targetOn(having('#combates'), 'combates')).toEqual({ selector: '#combates', found: true });
    expect(await targetOn(having(), 'combates')).toEqual({ selector: '[data-plitzi-el="combates"]', found: false });
    expect(awaited('combates')).toBe('[data-plitzi-el="combates"], combates, #combates');
    expect(awaited('404')).toBe('[data-plitzi-el="404"], 404');
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
