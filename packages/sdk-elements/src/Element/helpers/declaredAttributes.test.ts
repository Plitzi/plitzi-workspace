import { describe, expect, it } from 'vitest';

import { declaredAttributes } from './declaredAttributes';

/** A plugin as it is registered: its component, carrying its declaration. */
const plugin = Object.assign(() => null, {
  content: { attributes: { bpm: 112, still: false, kit: 'nebula', pattern: [] } }
});

describe('declaredAttributes', () => {
  it('reads what was bound as text as the type its default is', () => {
    expect(
      declaredAttributes(plugin, { bpm: '96', still: 'true', kit: 'arcade', pattern: '[1,2]', label: '7' })
    ).toEqual({ bpm: 96, still: true, kit: 'arcade', pattern: '[1,2]', label: '7' });
  });

  it('leaves what says nothing else as it is, and answers the same object when nothing changed', () => {
    const attributes = { bpm: 'fast', still: 'yes', kit: 'arcade' };

    expect(declaredAttributes(plugin, attributes)).toBe(attributes);
    expect(declaredAttributes(plugin, { bpm: ' ' })).toEqual({ bpm: ' ' });
  });

  it('hands a built-in element its attributes untouched: only a plugin carries a declaration', () => {
    const attributes = { bpm: '96' };

    expect(declaredAttributes(() => null, attributes)).toBe(attributes);
  });
});
