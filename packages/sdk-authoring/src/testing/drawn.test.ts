// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { drawnInPage } from './drawn';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every element laid out with a box, but those `hidden` names: jsdom lays nothing out. */
const laidOut = (hidden: string[] = []) =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return hidden.includes(this.getAttribute('data-plitzi-el') ?? '')
      ? new DOMRect(0, 0, 0, 0)
      : new DOMRect(0, 0, 200, 40);
  });

const region = { page: '[data-plitzi-el="room"]', notOwn: ['shell', 'shell-header', 'shell-body'] };

const page = (body: string) => {
  document.body.innerHTML = `
    <main data-plitzi-el="room">
      <div data-plitzi-el="shell">
        <header data-plitzi-el="shell-header">Night Drive · Rooms</header>
        <div data-plitzi-el="shell-body">${body}</div>
      </div>
    </main>`;
};

// A run's 404 drew its layout and nothing else: every check passed, nothing owed being missing.
describe('whether a page draws anything of its own', () => {
  it('is not, when only its layout says anything and its own parts are hidden', () => {
    laidOut(['room-cover']);
    page(
      '<section data-plitzi-el="room-desk" style="display: none"><h1 data-plitzi-el="room-title">Night Drive</h1></section><img data-plitzi-el="room-cover">'
    );

    expect(drawnInPage({ region })).toBe(false);
  });

  it('is, with a word, a picture or a control of its own', () => {
    laidOut();
    page('<p data-plitzi-el="room-missing">No room here.</p>');
    expect(drawnInPage({ region })).toBe(true);

    page('<button data-plitzi-el="room-back"></button>');
    expect(drawnInPage({ region })).toBe(true);

    // A page withheld from its visitor draws the platform's refusal itself, unmarked: the page's own words.
    page('<section data-withheld="forbidden"><h1>This page is not available to you</h1></section>');
    expect(drawnInPage({ region })).toBe(true);
  });

  it('says nothing when it cannot read the page', () => {
    page('');

    expect(drawnInPage({})).toBe(true);
    expect(drawnInPage({ region: { ...region, page: '[data-plitzi-el="elsewhere"]' } })).toBe(true);
  });
});
