// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { accessibleName, findOverflow, findSmallTargets, findUnnamed } from './scans';

/** jsdom lays nothing out: every box is given here, by the element's `data-box` — `left,top,width,height`. */
const withBoxes = (html: string): HTMLElement => {
  const page = document.createElement('div');
  page.setAttribute('data-box', '0,0,400,800');
  page.innerHTML = html;
  document.body.append(page);
  for (const element of [page, ...page.querySelectorAll('*')]) {
    const [left, top, width, height] = (element.getAttribute('data-box') ?? '0,0,100,30').split(',').map(Number);
    const rect = { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
    element.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
    // A one-box list is all the checks ask of it: whether the element is drawn at all.
    element.getClientRects = () => Object.assign([rect], { item: () => null }) as unknown as DOMRectList;
  }

  return page;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('accessibleName', () => {
  it('finds words where assistive technology does', () => {
    const page = withBoxes(`
      <span id="caption">Close the panel</span>
      <button id="a" aria-labelledby="caption"></button>
      <button id="b" aria-label="Open menu"></button>
      <label for="c">Work email</label><input id="c">
      <a id="d" href="/"><img alt="Plitzi home"></a>
      <button id="e" title="Settings"><i class="fa-solid fa-gear"></i></button>
      <input id="f" placeholder="Search">
      <button id="g"><i class="fa-solid fa-xmark"></i></button>`);
    const name = (id: string) => {
      const element = page.querySelector(`#${id}`);
      if (!element) {
        throw new Error(`no #${id} on the page`);
      }

      return accessibleName(element);
    };

    expect(['a', 'b', 'c', 'd', 'e', 'f'].map(name)).toEqual([
      'Close the panel',
      'Open menu',
      'Work email',
      'Plitzi home',
      'Settings',
      'Search'
    ]);
    expect(name('g')).toBe('');
  });
});

describe('findUnnamed', () => {
  it('points at an icon-only button and a picture with no alt, not at a decorative one', () => {
    const page = withBoxes(`
      <button data-plitzi-el="close"><i class="fa-solid fa-xmark"></i></button>
      <button>Save</button>
      <img src="a.png">
      <img src="b.png" alt="">`);

    expect(findUnnamed(page).map(finding => finding.note)).toEqual(['a button with no name', 'a picture with no alt']);
  });
});

describe('findSmallTargets', () => {
  it('points at a control under 24 px with another within its circle, not at one with room around it', () => {
    const page = withBoxes(`
      <button data-box="0,0,18,18">x</button>
      <button data-box="20,0,40,32">Save</button>
      <a href="/a" data-box="0,100,60,16" style="display: block">Quickstart</a>
      <a href="/b" data-box="0,128,60,16" style="display: block">Concepts</a>
      <p>Read <a href="/" data-box="0,300,30,16" style="display: inline">the docs</a></p>`);

    expect(findSmallTargets(page).map(finding => finding.note)).toEqual(['18 × 18 px, crowded']);
  });
});

describe('findOverflow', () => {
  it('points at the outermost box past the page’s side, unless something cuts it off', () => {
    const page = withBoxes(`
      <div id="wide" data-box="0,0,520,40"><span data-box="0,0,500,20">wide words</span></div>
      <div style="overflow-x: hidden" data-box="0,100,400,40"><div data-box="0,100,900,40">a track</div></div>
      <div data-box="10,200,380,40">fits</div>`);
    const found = findOverflow(page);

    expect(found.map(finding => finding.element.id)).toEqual(['wide']);
    expect(found[0].note).toBe('120 px past the page');
  });
});
