import type { Measured, MeasuredExtra } from './measureValues';
import type { KeptAnswer, KeptAsk, KeptView } from '../../browser/keptBrowser';

/**
 * The other site's pages a kept browser holds, and what is read on them at once (`measureKeeper.ts` runs it): a page
 * loaded for the first time is loaded once, every ask for it meanwhile reading the page that load ends with; a page
 * being read is counted (`readers`) and never closed under its reader — not to make room, not by a `fresh` ask, which
 * loads a new page and retires the old one until its last reader is done.
 *
 * An ask waiting on a load is a reader from the moment the page exists — counted before anything else runs — so making
 * room for another page never closes one its asks are about to read.
 */

export interface KeptPagesOptions<P> {
  /** Loads a page for the ask: as a visitor at its width and scheme sees it. */
  open: (asked: KeptAsk) => Promise<{ page: P } | { problem: string }>;
  /** Reads one element of a page, as `page measure` names it. */
  read: (page: P, target: string, options: { extra?: MeasuredExtra }) => Promise<Measured | { problem: string }>;
  close: (page: P) => Promise<void>;
  /** The pages kept at most: past it, the least lately loaded of those nobody reads go. */
  max: number;
}

interface Held<P> {
  page: P;
  loadedAt: number;
  readers: number;
}

export interface KeptPages<P = unknown> {
  measure: (asked: KeptAsk) => Promise<KeptAnswer>;
  /**
   * A page of the other site loaded already, for one ask alone — a state put on it, a play — taken out of those kept,
   * and another loaded in its place for the next: the site's settling (its widgets' scripts, seconds) paid ahead. With
   * none free to take, a page of its own is opened, and one is loaded for the next.
   */
  claim: (asked: KeptView) => Promise<{ page: P } | { problem: string }>;
  /** The pages held now, retired ones too. */
  size: () => number;
}

// Its motion too: a page held still is no page an animation is read on (`page measure --motion`).
export const keyOf = (asked: Pick<KeptAsk, 'url' | 'width' | 'scheme' | 'reducedMotion'>): string =>
  `${asked.url}|${String(asked.width)}|${asked.scheme ?? 'light'}${asked.reducedMotion === false ? '|motion' : ''}`;

export const keptPages = <P>({ open, read, close, max }: KeptPagesOptions<P>): KeptPages<P> => {
  const pages = new Map<string, Held<P>>();
  /** Pages a `fresh` ask replaced, still read by an ask that took them before: closed at their last reader. */
  const retired = new Set<Held<P>>();
  /** Each key's load under way, and the asks waiting on it: readers of the page it ends with, counted as it lands. */
  const loading = new Map<string, { done: Promise<Held<P> | { problem: string }>; waiting: number }>();
  let loads = 0;

  const closeHeld = async (held: Held<P>): Promise<void> => {
    await close(held.page).catch(() => undefined);
  };

  // Room for one more: the least lately loaded nobody reads, until at most `max` are kept.
  const makeRoom = async (): Promise<void> => {
    const free = [...pages.entries()]
      .filter(([, held]) => held.readers === 0)
      .sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    for (const [key, held] of free.slice(0, Math.max(0, pages.size - max))) {
      pages.delete(key);
      await closeHeld(held);
    }
  };

  // The ask becomes a reader of the page the key's load ends with — the load started now if none is under way.
  const awaitLoad = (key: string, asked: KeptAsk): Promise<Held<P> | { problem: string }> => {
    const ongoing = loading.get(key);
    if (ongoing) {
      ongoing.waiting += 1;

      return ongoing.done;
    }

    const entry: { done: Promise<Held<P> | { problem: string }>; waiting: number } = {
      done: Promise.resolve({ problem: 'not loaded' }),
      waiting: 1
    };
    entry.done = (async (): Promise<Held<P> | { problem: string }> => {
      const opened = await open(asked);
      if ('problem' in opened) {
        return opened;
      }

      // Its readers counted before anything else can run: room made next never closes it.
      loads += 1;
      const held: Held<P> = { page: opened.page, loadedAt: loads, readers: entry.waiting };
      pages.set(key, held);
      await makeRoom();

      return held;
    })().finally(() => loading.delete(key));
    loading.set(key, entry);

    return entry.done;
  };

  // A page loaded for the next reader, before one asks: loaded as a reader would load it, then read by nobody.
  const loadAhead = (key: string, asked: KeptView): void => {
    if (pages.has(key) || loading.has(key)) {
      return;
    }

    // Loaded as every kept page is, its motion held still: a claim says what it wants on the page it takes.
    const { reducedMotion: _motion, ...view } = asked;
    void awaitLoad(key, { ...view, targets: [] }).then(
      held => {
        if (!('problem' in held)) {
          held.readers -= 1;
        }
      },
      () => undefined
    );
  };

  const claim = async (asked: KeptView): Promise<{ page: P } | { problem: string }> => {
    const key = keyOf(asked);
    const kept = pages.get(key);
    if (kept && kept.readers === 0) {
      pages.delete(key);
      loadAhead(key, asked);

      return { page: kept.page };
    }

    loadAhead(key, asked);

    return open({ ...asked, targets: [] });
  };

  const measure = async (asked: KeptAsk): Promise<KeptAnswer> => {
    const key = keyOf(asked);
    const kept = pages.get(key);
    // Loaded again: the old page is no one's to find, closed now or once its last reader is done. A fresh ask while one
    // is loading reads what that load ends with — loaded fresh already.
    if (kept && asked.fresh === true && !loading.has(key)) {
      pages.delete(key);
      if (kept.readers === 0) {
        await closeHeld(kept);
      } else {
        retired.add(kept);
      }
    }

    const found = asked.fresh === true ? undefined : pages.get(key);
    let held: Held<P> | { problem: string };
    if (found) {
      found.readers += 1;
      held = found;
    } else {
      held = await awaitLoad(key, asked);
    }

    if ('problem' in held) {
      return held;
    }

    try {
      const readings: (Measured | { problem: string })[] = [];
      for (const target of asked.targets) {
        readings.push(await read(held.page, target, asked.extra ? { extra: asked.extra } : {}));
      }

      return { readings };
    } finally {
      held.readers -= 1;
      if (held.readers === 0 && retired.delete(held)) {
        await closeHeld(held);
      }
    }
  };

  return { measure, claim, size: () => pages.size + retired.size };
};
