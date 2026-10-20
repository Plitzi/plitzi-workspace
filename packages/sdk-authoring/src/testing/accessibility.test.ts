// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { accessibilityInPage } from './accessibility';
import { accessibilityIssues } from './inspect';

/** jsdom lays nothing out: every node is given a box here, so what is checked is what is written. */
const laidOut = () =>
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    // The check reads only whether a box exists; a list of one stands for it.
    return (this.closest('[data-hidden]') ? [] : [{}]) as unknown as DOMRectList;
  });

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('accessibilityInPage', () => {
  it('says headings that start below h1 or skip a level, and none for an order that holds', () => {
    laidOut();
    document.body.innerHTML = `
      <h2 data-plitzi-el="lede">Welcome</h2>
      <h1 data-plitzi-el="title">Pets</h1>
      <h2>Dogs</h2>
      <h4 data-plitzi-el="card-title">Luna</h4>
      <h3>Walks</h3>
      <h5 data-hidden>Hidden</h5>`;

    expect(accessibilityInPage().skippedHeadings).toEqual([
      { text: 'Welcome', level: 2, after: 0, elementId: 'lede' },
      { text: 'Luna', level: 4, after: 2, elementId: 'card-title' }
    ]);
  });

  it('says a link, a button or a field with no name, and takes every way a name is given', () => {
    laidOut();
    document.body.innerHTML = `
      <a href="/pets" data-plitzi-el="back"><svg aria-hidden="true"></svg></a>
      <button data-plitzi-el="close"><i class="fa-solid fa-xmark"></i></button>
      <input data-plitzi-el="q" />
      <a href="/walks">Walks</a>
      <a href="/home" aria-label="Home"><svg></svg></a>
      <button><img src="x.png" alt="Search" /></button>
      <label for="dog">Dog</label><select id="dog"></select>
      <label>Name <input /></label>
      <input placeholder="Search…" />
      <span id="t">Theme</span><button aria-labelledby="t"></button>
      <button title="Menu"></button>
      <button data-hidden></button>`;

    expect(accessibilityInPage().unnamed).toEqual([
      { what: 'a to /pets', elementId: 'back' },
      { what: 'button', elementId: 'close' },
      { what: 'input', elementId: 'q' }
    ]);
  });
});

describe('accessibilityIssues', () => {
  it('says each as a sentence with the way out, by the element it is about', () => {
    expect(
      accessibilityIssues({
        skippedHeadings: [
          { text: 'Welcome', level: 2, after: 0, elementId: 'lede' },
          { text: 'Luna', level: 4, after: 2 }
        ],
        unnamed: [{ what: 'button', elementId: 'close' }]
      })
    ).toEqual([
      {
        code: 'heading-skipped',
        message: expect.stringContaining('headings start at h2') as unknown,
        elementId: 'lede'
      },
      { code: 'heading-skipped', message: expect.stringContaining('make it an h3') as unknown },
      {
        code: 'control-unnamed',
        message: expect.stringContaining('button has no name a screen reader can read') as unknown,
        elementId: 'close'
      }
    ]);
  });
});
