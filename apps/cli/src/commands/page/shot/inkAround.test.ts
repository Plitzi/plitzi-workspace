// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inkAroundInPage } from './capture';

afterEach(() => {
  vi.restoreAllMocks();
});

/** The element's style as a browser computes it — every length in px, every colour `rgb(…)` — which jsdom does not. */
const painted = (
  style: Partial<Record<'boxShadow' | 'outlineStyle' | 'outlineWidth' | 'outlineOffset' | 'filter', string>>
) => {
  // The fields it reads, alone: a whole CSSStyleDeclaration has hundreds.
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    boxShadow: 'none',
    outlineStyle: 'none',
    outlineWidth: '0px',
    outlineOffset: '0px',
    filter: 'none',
    ...style
  } as CSSStyleDeclaration);

  return inkAroundInPage(document.createElement('div'));
};

// A picture cut to the box alone took a 2px ring off a card, and read as the page clipping it.
describe('what an element paints past its box', () => {
  it('is its outer shadows, its outline and its blur — the most of any side', () => {
    expect(painted({})).toBe(0);
    expect(painted({ boxShadow: 'rgb(56, 189, 248) 0px 0px 0px 2px' })).toBe(2);
    expect(
      painted({ boxShadow: 'rgba(0, 0, 0, 0.3) 0px 8px 24px -4px, rgb(255, 255, 255) 0px 0px 0px 1px inset' })
    ).toBe(28);
    expect(painted({ outlineStyle: 'solid', outlineWidth: '2px', outlineOffset: '3px' })).toBe(5);
    expect(painted({ filter: 'blur(4px)' })).toBe(8);
    expect(painted({ boxShadow: 'rgb(0, 0, 0) 0px 0px 0px 1px inset' })).toBe(0);
  });
});
