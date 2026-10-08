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

/** A list's box is its rows: one with none drawn is empty — said as that, with what to do, not as "no size". */
describe('probePage / an empty list', () => {
  it('says the list has no rows, and leaves a list with rows that has no box to the usual reason', () => {
    sized(100, 20);
    document.body.innerHTML =
      '<ul data-plitzi-el="saved" data-empty="1"></ul><ul data-plitzi-el="feed" data-empty="1"><li></li></ul>';
    const asked = {
      ...input([]),
      expected: [
        { id: 'saved', selector: '[data-plitzi-el="saved"]', list: true as const },
        { id: 'feed', selector: '[data-plitzi-el="feed"]', list: true as const }
      ]
    };

    expect(probePage(asked).hidden).toEqual([
      { id: 'saved', reason: expect.stringContaining('a list with no rows') as string },
      { id: 'feed', reason: 'it has no size (0×0)' }
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

    const findings = probePage(input(['nav', 'nav-link', 'bar', 'gone']));

    expect(findings.hidden).toEqual([{ id: 'gone', reason: 'display:none on itself' }]);
    // Said apart: looked at, and hidden at this width on purpose. jsdom computes no `@media` rule, so here the bar —
    // hidden by its base rule and shown only at another width — is the one hidden; a browser hides the nav too.
    expect(findings.byWidth).toEqual(['bar']);
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

describe('probePage / images nobody can see', () => {
  /** A picture under something hidden (`visible: false`) is not on the page as far as a visitor can tell. */
  it('does not ask after an image that is hidden, or under something hidden', () => {
    document.body.innerHTML =
      '<div style="display: none"><img src="/inside.jpg"></div><img src="/itself.jpg" style="visibility: hidden">';
    document.querySelectorAll('img').forEach(image => Object.defineProperty(image, 'complete', { value: false }));

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

describe('probePage / text in the colour behind it', () => {
  /** A box at `top`, 100×20, wherever the test puts it. */
  const at = (node: Element, top: number, height = 20): void => {
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top,
      right: 100,
      bottom: top + height,
      width: 100,
      height
    } as DOMRect);
  };

  /** jsdom stacks nothing: the elements under a point are what the test says, top first. */
  const stackedAt = (...stack: (Element | null)[]): void => {
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => stack.filter(layer => layer !== null)
    });
  };

  afterEach(() => {
    Reflect.deleteProperty(document, 'elementsFromPoint');
  });

  const legibility = { ...input([]), legibility: true };

  it('takes only what is under the text: a bar fixed over it is in front, not behind', () => {
    document.body.innerHTML = `
      <header style="background-color: rgb(255, 255, 255)"></header>
      <main style="background-color: rgb(0, 0, 0)"><p data-plitzi-el="lede" style="color: rgb(255, 255, 255)">Hello</p></main>`;
    const lede = document.querySelector('p');
    if (lede) {
      at(lede, 100);
    }

    stackedAt(document.querySelector('header'), lede, document.querySelector('main'), document.body);

    expect(probePage(legibility).illegible).toEqual([]);
  });

  it('still says text drawn in the colour of what is under it', () => {
    document.body.innerHTML = `
      <header style="background-color: rgb(0, 0, 0)"></header>
      <main style="background-color: rgb(255, 255, 255)"><p data-plitzi-el="lede" style="color: rgb(250, 250, 250)">Hello</p></main>`;
    const lede = document.querySelector('p');
    if (lede) {
      at(lede, 100);
    }

    stackedAt(document.querySelector('header'), lede, document.querySelector('main'), document.body);

    expect(probePage(legibility).illegible).toEqual([{ text: '"lede": "Hello"', contrast: 1.04, elementId: 'lede' }]);
  });

  it('reads the words a plugin draws inside an element of the space, by the element and a selector', () => {
    // A colour fixed for the light theme, drawn on the dark one: the status line under a plugin's machine.
    document.body.innerHTML = `
      <main style="background-color: rgb(29, 29, 32)">
        <div data-plitzi-el="machine"><p class="gm__status" style="color: rgb(28, 27, 31)">Ready</p></div>
      </main>`;
    const status = document.querySelector('p');
    if (status) {
      at(status, 100);
    }

    stackedAt(status, document.querySelector('div'), document.querySelector('main'), document.body);

    expect(probePage(legibility).illegible).toEqual([
      { text: '"machine" › <p.gm__status>: "Ready"', contrast: 1.02, elementId: 'machine' }
    ]);
  });

  it('reads a colour as the browser writes it — oklch, a mix — never its numbers as rgb', () => {
    // Near white on black, written as the space's tokens are: read as rgb, it was "near black on black".
    document.body.innerHTML = `
      <main style="background-color: rgb(0, 0, 0)">
        <p data-plitzi-el="token" style="color: oklch(0.97 0 0)">Light</p>
        <p data-plitzi-el="mixed" style="color: color(srgb 0.95 0.95 0.95 / 0.9)">Mixed</p>
      </main>`;
    for (const node of document.querySelectorAll('p')) {
      at(node, 100);
    }

    stackedAt(document.querySelector('main'), document.body);

    expect(probePage(legibility).illegible).toEqual([]);
  });

  it('leaves a muted caption, and words hidden from a screen reader as a decoration', () => {
    document.body.innerHTML = `
      <main style="background-color: rgb(255, 255, 255)">
        <p data-plitzi-el="caption" style="color: rgb(120, 120, 120)">Muted</p>
        <span data-plitzi-el="watermark" aria-hidden="true" style="color: rgb(250, 250, 250)">01</span>
      </main>`;
    for (const node of document.querySelectorAll('p, span')) {
      at(node, 100);
    }

    stackedAt(document.querySelector('main'), document.body);

    expect(probePage(legibility).illegible).toEqual([]);
  });

  it('reads its ancestors where the pane it scrolls in cuts it off — what the point hits there is another page part', () => {
    document.body.innerHTML = `
      <div class="pane" style="overflow-y: auto; background-color: rgb(0, 0, 0)">
        <p data-plitzi-el="below" style="color: rgb(255, 255, 255)">Below the fold</p>
      </div>
      <footer style="background-color: rgb(255, 255, 255)"></footer>`;
    const pane = document.querySelector('.pane');
    const below = document.querySelector('p');
    if (pane && below) {
      at(pane, 0, 300);
      at(below, 500);
    }

    stackedAt(document.querySelector('footer'), document.body);

    expect(probePage(legibility).illegible).toEqual([]);
  });
});

/** A header whose last links fell off a phone read as a page with nothing wrong: an ancestor hid them, nothing scrolled. */
describe('probePage / cut off at the screen’s edge', () => {
  it('names what an ancestor hides past the edge, and leaves what scrolls or moves on purpose', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 390, configurable: true });
    // jsdom has neither layout nor `checkVisibility`: every box here is drawn, where the test puts it.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      value(this: HTMLElement) {
        return !this.dataset.hidden;
      },
      configurable: true
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const [left, right] = (this.dataset.box ?? '0,390').split(',').map(Number);

      return { left, right, width: right - left, height: 20 } as DOMRect;
    });
    document.body.innerHTML = [
      // `overflow-x` written out: jsdom does not expand the shorthand a browser does.
      '<header style="overflow-x: hidden">',
      '<a data-plitzi-el="nav-home" data-box="10,60">Home</a>',
      '<a data-plitzi-el="nav-create" data-box="380,440">Create</a>',
      '</header>',
      '<div style="overflow-x: auto"><a data-plitzi-el="row-item" data-box="400,480">More</a></div>',
      '<div style="overflow-x: hidden"><span style="transform: translateX(-20px)">',
      '<span data-plitzi-el="ticker" data-box="300,700">Breaking</span></span></div>',
      // A closed menu, mounted and hidden: what is not drawn is not cut.
      '<header style="overflow-x: hidden"><a data-plitzi-el="menu-item" data-hidden="1" data-box="380,520">Sign out</a></header>'
    ].join('');

    const found = probePage({ ...input([]), overflow: true }).cutOff;

    delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
    expect(found).toEqual([{ id: 'nav-create', pixels: 50 }]);
  });
});
