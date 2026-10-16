import { describe, expect, it } from 'vitest';

import { sizeParts, sizePreset } from './helpers';

describe('background size', () => {
  it('tells the keywords from a size of its own', () => {
    expect(sizePreset('cover')).toBe('cover');
    expect(sizePreset('contain')).toBe('contain');
    expect(sizePreset('100px auto')).toBe('custom');
  });

  it('reads one value as the width, the height following the image', () => {
    expect(sizeParts('100px')).toEqual(['100px', 'auto']);
  });

  it('reads both values', () => {
    expect(sizeParts('50% 25%')).toEqual(['50%', '25%']);
  });
});
