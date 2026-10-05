import { describe, expect, it } from 'vitest';

import { coerceDeclaredParams } from './coerceDeclaredParams';

import type { InteractionCallback } from '@plitzi/sdk-shared';

const declared: InteractionCallback['params'] = {
  interval: { type: 'number', label: 'Interval' },
  paused: { type: 'boolean', label: 'Paused' },
  label: { type: 'text', label: 'Label' }
};

describe('coerceDeclaredParams', () => {
  it('hands each param over as the type its callback declares', () => {
    expect(coerceDeclaredParams(declared, { interval: '5000', paused: 'true', label: '12' })).toEqual({
      interval: 5000,
      paused: true,
      label: '12'
    });
  });

  it('leaves a value already of its type, text that is no number, and what it does not declare', () => {
    expect(coerceDeclaredParams(declared, { interval: 3, paused: false, other: '1' })).toEqual({
      interval: 3,
      paused: false,
      other: '1'
    });
    expect(coerceDeclaredParams(declared, { interval: 'soon' })).toEqual({ interval: 'soon' });
  });

  it('reads an empty number as nothing, so the component’s default applies', () => {
    expect(coerceDeclaredParams(declared, { interval: ' ' })).toEqual({ interval: undefined });
  });

  it('asks a declaration that follows the params with them', () => {
    const following: InteractionCallback['params'] = values => ({
      value: { type: values.kind === 'count' ? 'number' : 'text', label: 'Value' },
      kind: { type: 'text', label: 'Kind' }
    });

    expect(coerceDeclaredParams(following, { kind: 'count', value: '7' })).toEqual({ kind: 'count', value: 7 });
    expect(coerceDeclaredParams(following, { kind: 'name', value: '7' })).toEqual({ kind: 'name', value: '7' });
  });
});
