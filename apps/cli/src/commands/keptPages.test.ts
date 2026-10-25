import { describe, expect, it } from 'vitest';

import { keptPages } from './keptPages';

import type { KeptAsk } from '../browser/keptBrowser';

/** A promise the test settles when it says so: a load or a read held open to see what happens meanwhile. */
const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(settle => {
    resolve = settle;
  });

  return { promise, resolve };
};

/** A page as the test knows it: by the order it was loaded in. */
interface Page {
  id: number;
}

const ask = (url: string, extra: Partial<KeptAsk> = {}): KeptAsk => ({
  url,
  width: 1440,
  height: 900,
  targets: ['h1'],
  ...extra
});

/** Pages loaded and read as the test holds them: each load and each read waits until the test lets it go. */
const bench = (max = 10) => {
  const loads: { url: string; land: (ok?: boolean) => void }[] = [];
  const reads: { page: number; finish: () => void }[] = [];
  const closed: number[] = [];
  let made = 0;
  const pages = keptPages<Page>({
    open: asked => {
      const loaded = deferred<{ page: Page } | { problem: string }>();
      loads.push({
        url: asked.url,
        land: (ok = true) => {
          made += ok ? 1 : 0;
          loaded.resolve(ok ? { page: { id: made } } : { problem: `${asked.url} did not answer` });
        }
      });

      return loaded.promise;
    },
    read: (page, target) => {
      const done = deferred<{ problem: string }>();
      reads.push({
        page: page.id,
        finish: () => done.resolve({ problem: `${target} read on page ${String(page.id)}` })
      });

      return done.promise;
    },
    close: page => {
      closed.push(page.id);

      return Promise.resolve();
    },
    max
  });
  // Lets every pending promise run: what a load or a read that just settled does next.
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  return { pages, loads, reads, closed, settle };
};

// Carlos: the kept browser is shared by a run's agents at once — nothing one asks is pulled from under another.
describe('the pages a kept browser holds', () => {
  it('loads a page once for every ask that comes while it loads, each reading the page it ends with', async () => {
    const { pages, loads, reads, settle } = bench();
    const first = pages.measure(ask('https://site.test/'));
    const second = pages.measure(ask('https://site.test/'));
    await settle();

    expect(loads).toHaveLength(1);
    loads[0]?.land();
    await settle();
    reads.forEach(read => read.finish());

    expect(await first).toEqual({ readings: [{ problem: 'h1 read on page 1' }] });
    expect(await second).toEqual({ readings: [{ problem: 'h1 read on page 1' }] });
  });

  it('never closes a page being read to make room — nor the one just loaded — and closes the oldest free first', async () => {
    const { pages, loads, reads, closed, settle } = bench(1);
    const a = pages.measure(ask('https://site.test/a'));
    await settle();
    loads[0]?.land();
    await settle();
    // Past the most kept while page 1 is read: the new page 2 is its ask's from the moment it exists.
    const b = pages.measure(ask('https://site.test/b'));
    await settle();
    loads[1]?.land();
    await settle();

    expect(closed).toEqual([]);
    expect(pages.size()).toBe(2);
    reads.forEach(read => read.finish());
    await Promise.all([a, b]);

    // Both free now: a third page makes room, the oldest first.
    const c = pages.measure(ask('https://site.test/c'));
    await settle();
    loads[2]?.land();
    await settle();

    expect(closed).toEqual([1, 2]);
    reads.at(-1)?.finish();
    expect(await c).toEqual({ readings: [{ problem: 'h1 read on page 3' }] });
  });

  it('loads a page again when asked fresh, the old one closed only once its last reader is done', async () => {
    const { pages, loads, reads, closed, settle } = bench();
    const reading = pages.measure(ask('https://site.test/'));
    await settle();
    loads[0]?.land();
    await settle();
    const fresh = pages.measure(ask('https://site.test/', { fresh: true }));
    const alsoFresh = pages.measure(ask('https://site.test/', { fresh: true }));
    await settle();

    // Two fresh asks at once: one load, both reading it.
    expect(loads).toHaveLength(2);
    loads[1]?.land();
    await settle();
    reads.slice(1).forEach(read => read.finish());

    expect(await fresh).toEqual({ readings: [{ problem: 'h1 read on page 2' }] });
    expect(await alsoFresh).toEqual({ readings: [{ problem: 'h1 read on page 2' }] });
    expect(closed).toEqual([]);
    reads[0]?.finish();
    expect(await reading).toEqual({ readings: [{ problem: 'h1 read on page 1' }] });
    await settle();
    expect(closed).toEqual([1]);
  });

  it('answers every ask waiting on a load that failed with its problem, and loads again for the next', async () => {
    const { pages, loads, reads, settle } = bench();
    const first = pages.measure(ask('https://site.test/'));
    const second = pages.measure(ask('https://site.test/'));
    await settle();
    loads[0]?.land(false);

    expect(await first).toEqual({ problem: 'https://site.test/ did not answer' });
    expect(await second).toEqual({ problem: 'https://site.test/ did not answer' });
    const again = pages.measure(ask('https://site.test/'));
    await settle();
    expect(loads).toHaveLength(2);
    loads[1]?.land();
    await settle();
    reads.forEach(read => read.finish());
    expect(await again).toEqual({ readings: [{ problem: 'h1 read on page 1' }] });
  });

  // A state read on the other site paid its settling — its widgets' scripts, seconds — every time.
  it('hands a free kept page to one ask alone, and loads another in its place for the next', async () => {
    const { pages, loads, reads, settle } = bench();
    const first = pages.measure(ask('https://site.test/'));
    await settle();
    loads[0]?.land();
    await settle();
    reads[0]?.finish();
    await first;

    const taken = await pages.claim({ url: 'https://site.test/', width: 1440, height: 900 });
    expect(taken).toEqual({ page: { id: 1 } });
    // Its place loaded again, read by nobody until a reader comes.
    expect(loads).toHaveLength(2);
    loads[1]?.land();
    await settle();
    const after = pages.measure(ask('https://site.test/'));
    await settle();
    reads.at(-1)?.finish();
    expect(await after).toEqual({ readings: [{ problem: 'h1 read on page 2' }] });
  });

  it('never takes a page being read: one of its own is opened, and one loaded ahead for the next', async () => {
    const { pages, loads, settle } = bench();
    const reading = pages.measure(ask('https://site.test/'));
    await settle();
    loads[0]?.land();
    await settle();

    const taken = pages.claim({ url: 'https://site.test/', width: 1440, height: 900 });
    await settle();
    // Its own page: the reader keeps page 1.
    expect(loads).toHaveLength(2);
    loads[1]?.land();
    expect(await taken).toEqual({ page: { id: 2 } });
    expect(pages.size()).toBe(1);
    void reading;
  });

  it('opens a page of its own with none kept, and the page it loaded ahead is the next one’s', async () => {
    const { pages, loads, settle } = bench();
    const own = pages.claim({ url: 'https://site.test/', width: 390, height: 900 });
    await settle();
    expect(loads).toHaveLength(2);
    loads.forEach(load => load.land());
    await settle();

    const opened = await own;
    const next = await pages.claim({ url: 'https://site.test/', width: 390, height: 900 });
    const ids = [opened, next].map(each => ('page' in each ? each.page.id : undefined));
    expect(ids.every(id => typeof id === 'number')).toBe(true);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
