import { describe, expect, it } from 'vitest';

import { elementDeclarations } from './elements/declarations';
import { defaultElements } from './index';

/**
 * What is declared and has no component of its own here: the parts their element draws (a list draws its rows, a tab
 * container its tabs), and the SDK, which its app registers. Anything else declared is authored by type, and a type
 * the runtime has no component for draws nothing, without a word — `chart` did, on every page that used one.
 */
const DRAWN_ELSEWHERE = new Set([
  'listItem',
  'tabContainerItem',
  'tabContainerBody',
  'tabContainerHeader',
  'carouselTrack',
  'dropdownPopup',
  'plitziSdk'
]);

describe('the default elements', () => {
  it('draw every element type that is declared', () => {
    const drawn = new Set(Object.keys(defaultElements));
    const missing = Object.values(elementDeclarations)
      .map(declaration => declaration.type)
      .filter(type => !drawn.has(type) && !DRAWN_ELSEWHERE.has(type));

    expect(missing).toEqual([]);
  });
});
