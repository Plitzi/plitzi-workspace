import { describe, expect, it } from 'vitest';

import processSelectorVariables from './processSelectorVariables';

import type { StyleItem } from '@plitzi/sdk-shared';

const withVariables = (variables: StyleItem['variables']): Omit<StyleItem, 'cache'> => ({
  name: 'card',
  type: 'class',
  attributes: { base: {} },
  variables
});

describe('processSelectorVariables', () => {
  it('writes a colour per scheme, and its default where it has one', () => {
    expect(
      processSelectorVariables(withVariables({ color: { tint: { light: '#111', dark: '#eee', default: '#111' } } }))
    ).toEqual({ default: ['--tint:#111;'], light: ['--tint:#111;'], dark: ['--tint:#eee;'] });
  });

  // A selector's colour given as one value was written `--tint:undefined;`, and overrode the good value.
  it('writes a colour given as one value as that value, never undefined', () => {
    const written = processSelectorVariables(withVariables({ color: { tint: '#222' } }));

    expect(written).toEqual({ default: ['--tint:#222;'], light: [], dark: [] });
  });

  it('leaves out the default of a colour given per scheme alone', () => {
    const written = processSelectorVariables(withVariables({ color: { tint: { light: '#111', dark: '#eee' } } }));

    expect(written?.default).toEqual([]);
    expect(JSON.stringify(written)).not.toContain('undefined');
  });

  it('writes spacing, shadows and custom values as they are, and an unknown category as a custom one', () => {
    expect(
      processSelectorVariables(
        withVariables({ spacing: { gap: '8px' }, shadow: { lift: '0 1px 2px #000' }, unknown: { x: '1' } } as never)
      )?.default
    ).toEqual(['--gap:8px;', '--lift:0 1px 2px #000;', '--x:1;']);
  });

  it('answers nothing for a selector with no variables', () => {
    expect(processSelectorVariables(withVariables(undefined))).toBeUndefined();
    expect(processSelectorVariables(withVariables({}))).toBeUndefined();
  });
});
