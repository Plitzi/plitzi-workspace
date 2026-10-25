// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { drawnOtherwise } from './inspect';

// "Hydration failed" for the hero's time, found by reading the diff — React names no element in a build.
describe('a hydration error, named', () => {
  it('names the innermost elements the server drew otherwise, with both texts', () => {
    const served =
      '<main data-plitzi-el="home-hero"><time data-plitzi-el="home-hero-time">18:00h GMT+1</time><p data-plitzi-el="home-hero-venue">Sevilla</p></main>';
    document.body.innerHTML = served.replace('18:00h GMT+1', '11:00h GMT-6');

    expect(drawnOtherwise(served)).toEqual([
      'home-hero-time ("18:00h GMT+1" from the server → "11:00h GMT-6" in the browser)'
    ]);
    document.body.innerHTML = served;
    expect(drawnOtherwise(served)).toEqual([]);
  });
});
