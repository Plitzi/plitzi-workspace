// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { probePage } from './probe';

const input = (ids: string[]) => ({
  expected: ids.map(id => ({ id, selector: `[data-plitzi-el="${id}"]` })),
  images: false,
  overflow: false,
  legibility: false
});

/** jsdom lays nothing out: every box is 0×0 unless a test says otherwise. */
const sized = (width: number, height: number) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    // The probe reads only the size; a whole DOMRect would be fields nothing here looks at.
    return { width: this.dataset.empty ? 0 : width, height: this.dataset.empty ? 0 : height } as DOMRect;
  });

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('probePage / display:contents', () => {
  it('takes a box-less slot as showing what its children show', () => {
    sized(100, 20);
    document.body.innerHTML =
      '<div data-plitzi-el="slot" style="display: contents"><p data-plitzi-el="lede">Hello</p></div>';

    expect(probePage(input(['slot', 'lede'])).hidden).toEqual([]);
  });

  it('says so when nothing inside one shows', () => {
    sized(100, 20);
    document.body.innerHTML = '<div data-plitzi-el="slot" style="display: contents"><p data-empty="1"></p></div>';

    expect(probePage(input(['slot'])).hidden).toEqual([
      { id: 'slot', reason: 'it has no box of its own (display:contents) and nothing inside it shows' }
    ]);
  });
});

/** Whether a node or any of its ancestors is `display: none` — which, in a browser, leaves it no box. */
const hiddenByDisplay = (node: Element): boolean =>
  getComputedStyle(node).display === 'none' || (node.parentElement !== null && hiddenByDisplay(node.parentElement));

describe('probePage / hidden by the width it is drawn at', () => {
  it('lets an element a breakpoint hides — or shows only at another width — be, and reports one hidden for good', () => {
    // As a browser draws it: no box under anything `display: none`.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      // The probe reads only the size; a whole DOMRect would be fields nothing here looks at.
      return (hiddenByDisplay(this) ? { width: 0, height: 0 } : { width: 100, height: 20 }) as DOMRect;
    });
    document.head.innerHTML = `<style>
      .desktop-nav { display: flex }
      @media (max-width: 99999px) { .desktop-nav { display: none } }
      .bottom-bar { display: none }
      @media (max-width: 1px) { .bottom-bar { display: flex } }
      .gone { display: none }
    </style>`;
    document.body.innerHTML = `
      <nav data-plitzi-el="nav" class="desktop-nav"><a data-plitzi-el="nav-link">Shop</a></nav>
      <div data-plitzi-el="bar" class="bottom-bar"></div>
      <div data-plitzi-el="gone" class="gone"></div>`;

    expect(probePage(input(['nav', 'nav-link', 'bar', 'gone'])).hidden).toEqual([
      { id: 'gone', reason: 'display:none on itself' }
    ]);
  });
});

describe('probePage / images', () => {
  /** A lazy image at `left`, `top`, 100×100, never fetched — as a browser leaves one it has not been asked for yet. */
  const lazyImageAt = (src: string, left: number, top: number): HTMLImageElement => {
    const image = document.createElement('img');
    image.loading = 'lazy';
    image.src = src;
    Object.defineProperty(image, 'complete', { value: false });
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left,
      top,
      right: left + 100,
      bottom: top + 100,
      width: 100,
      height: 100
    } as DOMRect);

    return image;
  };

  it('waits on a lazy image out of sight — below the fold or beside the screen in a carousel — and not on one in it', () => {
    document.body.append(
      lazyImageAt('/below.jpg', 0, window.innerHeight + 10),
      lazyImageAt('/beside.jpg', window.innerWidth + 10, 0),
      lazyImageAt('/in-sight.jpg', 0, 0)
    );

    expect(probePage({ ...input([]), images: true }).brokenImages).toEqual([
      { source: `${window.location.origin}/in-sight.jpg` }
    ]);
  });

  it('waits on one its carousel’s track cuts off, though the screen would show it', () => {
    const track = document.createElement('div');
    // As an attribute: jsdom drops `overflow-x` set through the style object.
    track.setAttribute('style', 'overflow-x: hidden');
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100
    } as DOMRect);
    track.append(lazyImageAt('/third-slide.jpg', 300, 0));
    document.body.append(track);

    expect(probePage({ ...input([]), images: true }).brokenImages).toEqual([]);
  });
});

describe('probePage / which element a finding is about', () => {
  it('names the space’s element an image sits in', () => {
    document.body.innerHTML = '<figure data-plitzi-el="hero-photo"><img src="/hero.jpg"></figure>';
    Object.defineProperty(document.querySelector('img'), 'complete', { value: false });

    expect(probePage({ ...input([]), images: true }).brokenImages).toEqual([
      { source: `${window.location.origin}/hero.jpg`, elementId: 'hero-photo' }
    ]);
  });
});

describe('probePage / sideways scroll', () => {
  /** A box `right` px wide from the left edge, as the browser would lay it out. */
  const boxTo = (node: HTMLElement, right: number): HTMLElement => {
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right,
      bottom: 100,
      width: right,
      height: 100
    } as DOMRect);

    return node;
  };

  const element = (style: string, right: number, ...children: HTMLElement[]): HTMLElement => {
    const node = document.createElement('div');
    // As an attribute: jsdom drops `overflow-x` set through the style object.
    node.setAttribute('style', style);
    node.append(...children);

    return boxTo(node, right);
  };

  it('lets a row that scrolls by itself — a carousel — hold what is wider than the screen', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
    document.body.append(element('overflow-x: auto', 400, element('', 1200)));

    expect(probePage({ ...input([]), overflow: true }).overflow).toBeNull();
  });

  it('reports what is wider than the screen inside the pane the page itself scrolls in', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
    const pane = element('overflow: auto', 400, element('', 900));
    pane.className = 'plitzi-sdk';
    document.body.append(pane);

    expect(probePage({ ...input([]), overflow: true }).overflow).toMatchObject({ pixels: 500 });
  });
});
