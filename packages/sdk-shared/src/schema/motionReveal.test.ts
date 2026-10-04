import { afterEach, describe, expect, it, vi } from 'vitest';

import { revealOnView } from './motionReveal';

/** jsdom has no `IntersectionObserver`: one whose entries the test hands in, as the browser would on a scroll. */
class FakeObserver {
  static current: FakeObserver | undefined;

  readonly observed = new Set<Element>();

  constructor(private readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
    FakeObserver.current = this;
  }

  observe(element: Element): void {
    this.observed.add(element);
  }

  unobserve(element: Element): void {
    this.observed.delete(element);
  }

  disconnect(): void {
    this.observed.clear();
  }

  scrolledTo(...elements: Element[]): void {
    this.callback(elements.map(target => ({ target, isIntersecting: true })));
  }
}

const tree = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);

  return root;
};

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('revealOnView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('marks an arrival seen the first time it comes into view, and stops watching it', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const root = tree(
      '<div id="card" data-motion-on="view" data-motion-enter="fade-up"></div><p data-motion-on="load"></p>'
    );
    const card = root.querySelector('#card');
    if (!card) {
      throw new Error('no card');
    }

    revealOnView(root);

    expect([...(FakeObserver.current?.observed ?? [])]).toEqual([card]);
    expect(card.hasAttribute('data-motion-seen')).toBe(false);

    FakeObserver.current?.scrolledTo(card);

    expect(card.hasAttribute('data-motion-seen')).toBe(true);
    expect(FakeObserver.current?.observed.size).toBe(0);
  });

  it('watches what arrives later and what changes to view, and nothing once stopped', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const root = tree('<p id="lead" data-motion-on="load"></p>');
    const stop = revealOnView(root);

    const row = document.createElement('li');
    row.setAttribute('data-motion-on', 'view');
    root.append(row);
    root.querySelector('#lead')?.setAttribute('data-motion-on', 'view');
    await flush();

    expect(FakeObserver.current?.observed.size).toBe(2);

    stop();
    root.append(row.cloneNode());
    await flush();

    expect(FakeObserver.current?.observed.size).toBe(0);
  });

  it('shows every arrival at once in a browser that cannot tell what is on screen', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const root = tree('<div data-motion-on="view"></div><div data-motion-on="view" data-motion-seen></div>');

    revealOnView(root);

    expect(root.querySelectorAll('[data-motion-seen]')).toHaveLength(2);
  });
});
