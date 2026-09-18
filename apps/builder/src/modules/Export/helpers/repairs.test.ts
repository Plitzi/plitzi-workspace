import { describe, expect, it } from 'vitest';

import { groupCorrections, repairLabel } from './repairs';

describe('groupCorrections', () => {
  it('groups repairs by kind and lists the same repair once, with how often it was made', () => {
    const groups = groupCorrections([
      { code: 'fixed-attribute', message: 'A link target of "_blank" is "blank" today.' },
      { code: 'dropped-field', message: 'Dropped "category" on 3 elements: nothing reads it.' },
      { code: 'fixed-attribute', message: 'A link target of "_blank" is "blank" today.' }
    ]);

    expect(groups).toEqual([
      {
        code: 'fixed-attribute',
        label: 'Attribute values corrected',
        total: 2,
        messages: [{ text: 'A link target of "_blank" is "blank" today.', count: 2 }]
      },
      {
        code: 'dropped-field',
        label: 'Unused element fields removed',
        total: 1,
        messages: [{ text: 'Dropped "category" on 3 elements: nothing reads it.', count: 1 }]
      }
    ]);
  });
});

describe('repairLabel', () => {
  it('says what a kind of repair is, and falls back to its code for one it does not know', () => {
    expect(repairLabel('dropped-attribute')).toBe('Attributes nothing reads removed');
    expect(repairLabel('something-new')).toBe('something-new');
  });
});
