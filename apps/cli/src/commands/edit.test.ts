import { describe, expect, it } from 'vitest';

import { parseSets } from './edit';

describe('what plitzi edit --set writes', () => {
  it('keeps the kind an attribute already has', () => {
    expect(parseSets(['level=3', 'required=false', 'content=42'], { level: 2, required: true, content: 'x' })).toEqual({
      changes: [
        { key: 'level', value: 3 },
        { key: 'required', value: false },
        { key: 'content', value: '42' }
      ]
    });
  });

  // Words that look like a number stay words: only an attribute that already holds a number is written as one.
  it('writes a new attribute as true or false when it reads so, and as words otherwise', () => {
    expect(parseSets(['decorative=true', 'label=2026'], {})).toEqual({
      changes: [
        { key: 'decorative', value: true },
        { key: 'label', value: '2026' }
      ]
    });
  });

  it('refuses what cannot be written as the attribute is', () => {
    expect(parseSets(['level=big'], { level: 2 })).toEqual({ problem: '`level` is a number: "big" is not one' });
    expect(parseSets(['hidden=maybe'], { hidden: false })).toEqual({
      problem: '`hidden` is true or false: "maybe" is neither'
    });
    expect(parseSets(['content'], {})).toHaveProperty('problem');
  });
});
