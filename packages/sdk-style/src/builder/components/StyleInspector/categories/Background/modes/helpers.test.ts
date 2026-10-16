import { describe, expect, it } from 'vitest';

import { centerParts, customExtentFor, isExtentKeyword, joinCenter } from './helpers';

describe('gradient center', () => {
  it('reads no center as the middle', () => {
    expect(centerParts('')).toEqual(['center', 'center']);
  });

  it('reads both axes', () => {
    expect(centerParts('20% 30%')).toEqual(['20%', '30%']);
  });

  it('leaves the middle out when written back', () => {
    expect(joinCenter('center', 'center')).toBe('');
    expect(joinCenter('20%', 'center')).toBe('20% center');
  });
});

describe('radial size', () => {
  it('tells a keyword from a size of its own', () => {
    expect(isExtentKeyword('closest-side')).toBe(true);
    expect(isExtentKeyword('100px')).toBe(false);
  });

  it('starts a size of its own as one length for a circle and two for an ellipse', () => {
    expect(customExtentFor('circle')).toBe('100px');
    expect(customExtentFor('ellipse')).toBe('50% 50%');
  });
});
