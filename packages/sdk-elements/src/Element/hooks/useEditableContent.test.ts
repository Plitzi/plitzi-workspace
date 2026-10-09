import { describe, expect, it } from 'vitest';

import { contentText } from './useEditableContent';

describe('contentText', () => {
  it('draws text as written and a number written out, 0 included', () => {
    expect(contentText('Hello')).toBe('Hello');
    expect(contentText('')).toBe('');
    expect(contentText(0)).toBe('0');
    expect(contentText(42)).toBe('42');
  });

  it('draws nothing for a binding that resolved to nothing', () => {
    expect(contentText(undefined)).toBe('');
    expect(contentText(null)).toBe('');
  });

  it('draws anything else as its JSON, so a wrong binding is visible rather than blank', () => {
    expect(contentText({ name: 'Nova' })).toBe('{"name":"Nova"}');
    expect(contentText(true)).toBe('true');
  });
});
