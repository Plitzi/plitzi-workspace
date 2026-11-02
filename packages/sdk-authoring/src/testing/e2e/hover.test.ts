// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { endlesslyMovedInPage, hoverElement } from './page';

import type { E2eElement } from './page';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A browser's, which jsdom has none of: what an animation's effect is when it moves an element. */
class KeyframeEffectStub {
  constructor(
    readonly target: Element,
    readonly getComputedTiming: () => { iterations: number }
  ) {}
}

/** An animation as the page lists it: running, on `target`, `iterations` times. */
const animation = (target: Element, iterations: number) =>
  // The fields the page reads, alone: jsdom has no Animation to make one with.
  ({
    playState: 'running',
    effect: new KeyframeEffectStub(target, () => ({ iterations }))
  }) as unknown as Animation;

// A map region with an endless pulse ring never held still for Playwright's hover: it timed out "still moving".
describe('a hover', () => {
  it('reads an endless animation on the element, inside it or around it — never one that ends, or elsewhere', () => {
    vi.stubGlobal('KeyframeEffect', KeyframeEffectStub);
    document.body.innerHTML = '<div id="map"><a id="fra"><span id="ring"></span></a></div><p id="other"></p>';
    const byId = (id: string): Element => {
      const node = document.getElementById(id);
      if (!node) {
        throw new Error(`no #${id}`);
      }

      return node;
    };
    const [map, fra, ring, other] = ['map', 'fra', 'ring', 'other'].map(byId);
    const listed = (animations: Animation[]) => {
      document.getAnimations = () => animations;

      return endlesslyMovedInPage(fra);
    };

    expect(listed([animation(ring, Infinity)])).toBe(true);
    expect(listed([animation(map, Infinity)])).toBe(true);
    expect(listed([animation(fra, 3)])).toBe(false);
    expect(listed([animation(other, Infinity)])).toBe(false);
  });

  it('points at an element an endless animation moves where it is now, and waits for any other to hold still', async () => {
    const asked: unknown[] = [];
    const element = (moving: boolean) => ({
      hover: (options: unknown) => {
        asked.push(options);

        return Promise.resolve();
      },
      // What it answers is what the test says, whatever is run in it: hoverElement runs one function, whose result it is.
      evaluate: (() => Promise.resolve(moving)) as E2eElement['evaluate']
    });

    await hoverElement(element(true), { timeout: 3000 });
    await hoverElement(element(false), { timeout: 3000 });

    expect(asked).toEqual([{ timeout: 3000, force: true }, { timeout: 3000 }]);
  });
});
