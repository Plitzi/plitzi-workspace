// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sightOf, sightText } from './sight';

/**
 * jsdom lays nothing out, nor reads the `overflow` shorthand (written long here): each element's box is its `data-box`
 * ("left,top,width,height"), its padding box the same, and what it holds past that its `data-scroll` ("width,height").
 */
const laidOut = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const [left = 0, top = 0, width = 0, height = 0] = (this.dataset.box ?? '0,0,0,0').split(',').map(Number);

    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  });
  const size = (axis: 'width' | 'height', of: 'client' | 'scroll') =>
    function (this: HTMLElement): number {
      const [, , width = 0, height = 0] = (this.dataset.box ?? '0,0,0,0').split(',').map(Number);
      const [scrollWidth = width, scrollHeight = height] = (this.dataset.scroll ?? '').split(',').map(Number);

      return of === 'client' ? (axis === 'width' ? width : height) : axis === 'width' ? scrollWidth : scrollHeight;
    };
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(size('width', 'client'));
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(size('height', 'client'));
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(size('width', 'scroll'));
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(size('height', 'scroll'));
};

const el = (id: string): Element => {
  const found = document.querySelector(`[data-plitzi-el="${id}"]`);
  if (!found) {
    throw new Error(`${id} is in the fixture`);
  }

  return found;
};

beforeEach(() => {
  laidOut();
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'elementFromPoint');
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

// A run's cyclone panel read visible:true at y=614 inside a 495 px column under the legend, and its --expect passed:
// every check of the run passed on a panel no visitor saw.
describe('sightOf', () => {
  it('reads an element on the screen as seen', () => {
    document.body.innerHTML = '<p data-plitzi-el="title" data-box="20,20,300,40">Tremor</p>';

    expect(sightOf(el('title'))).toEqual({ seen: true });
  });

  it('says the box that clips it, when that box does not scroll', () => {
    document.body.innerHTML =
      '<div data-plitzi-el="track" style="overflow-x: hidden; overflow-y: hidden" data-box="0,0,400,200" data-scroll="1200,200">' +
      '<div data-plitzi-el="slide-3" data-box="800,0,400,200">Third</div></div>';

    expect(sightOf(el('slide-3'))).toEqual({ seen: false, why: 'clipped', by: 'track' });
  });

  it('names the scrolling box a visitor scrolls to bring it into sight', () => {
    document.body.innerHTML =
      '<div data-plitzi-el="left-column" style="overflow-x: hidden; overflow-y: auto" data-box="22,118,300,495" data-scroll="300,1100">' +
      '<section data-plitzi-el="cyclones-panel" data-box="22,614,300,465">ARNAB</section></div>';

    expect(sightOf(el('cyclones-panel'))).toEqual({ seen: true, scrolled: 'left-column' });
    expect(sightText(sightOf(el('cyclones-panel')))).toBe('out of sight until left-column is scrolled');
  });

  it('keeps a part below the fold of a page that scrolls in sight, and not one of a page locked to its screen', () => {
    document.body.innerHTML = '<footer data-plitzi-el="footer" data-box="0,2000,1440,200">Footer</footer>';

    expect(sightOf(el('footer'))).toEqual({ seen: true });

    document.head.innerHTML = '<style>html, body { overflow-y: hidden }</style>';

    expect(sightOf(el('footer'))).toEqual({ seen: false, why: 'outside', by: 'the screen' });
  });

  it('says what is drawn over every part of it in sight, and leaves a clear layer over it seen', () => {
    document.body.innerHTML =
      '<section data-plitzi-el="panel" data-box="22,500,300,100">ARNAB</section>' +
      '<div data-plitzi-el="legend" style="background-color: rgb(255, 255, 255)" data-box="0,480,400,400"></div>' +
      '<div data-plitzi-el="layer" data-box="0,0,1440,900"></div>';
    const over = (id: string) =>
      Object.defineProperty(document, 'elementFromPoint', { value: () => el(id), configurable: true });

    over('legend');
    expect(sightOf(el('panel'))).toEqual({ seen: false, why: 'covered', by: 'legend' });

    over('layer');
    expect(sightOf(el('panel'))).toEqual({ seen: true });

    over('panel');
    expect(sightOf(el('panel'))).toEqual({ seen: true });
  });

  it('reads an element with nothing drawn as not seen, said in words', () => {
    document.body.innerHTML = '<span data-plitzi-el="dot" data-box="0,0,0,0"></span>';

    expect(sightOf(el('dot'))).toEqual({ seen: false, why: 'no-size' });
    expect(sightText({ seen: false, why: 'clipped', by: 'track' })).toContain('clipped by track');
  });
});
