import { describe, expect, it } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';

import SchemaReducer, { SchemaActions } from './SchemaReducer';

import type { SchemaFlag } from '@plitzi/sdk-shared';

const flag = (value: boolean): SchemaFlag => ({ value, rules: [] });

describe('SchemaReducer feature flags', () => {
  it('declares a flag in a schema that had none, and changes it under the same name', () => {
    const declared = SchemaReducer(EMPTY_SCHEMA.schema, {
      type: SchemaActions.SCHEMA_SET_FLAG,
      name: 'newCheckout',
      flag: flag(false)
    });

    expect(declared.flags).toEqual({ newCheckout: flag(false) });

    const changed = SchemaReducer(declared, {
      type: SchemaActions.SCHEMA_SET_FLAG,
      name: 'newCheckout',
      flag: flag(true)
    });

    expect(changed.flags).toEqual({ newCheckout: flag(true) });
  });

  it('removes a flag, and leaves the schema alone for one it does not declare', () => {
    const declared = { ...EMPTY_SCHEMA.schema, flags: { a: flag(true), b: flag(false) } };

    expect(SchemaReducer(declared, { type: SchemaActions.SCHEMA_REMOVE_FLAG, name: 'a' }).flags).toEqual({
      b: flag(false)
    });
    expect(SchemaReducer(declared, { type: SchemaActions.SCHEMA_REMOVE_FLAG, name: 'gone' })).toBe(declared);
  });
});

// The builder wrote a setting only where the space already had a value for it: a site's name, its robots.txt, set in
// the builder, were kept by the platform and lost on the canvas until the next load.
describe('SchemaReducer settings', () => {
  it('writes a setting the space has no value for yet, and leaves a key no space carries alone', () => {
    const named = SchemaReducer(EMPTY_SCHEMA.schema, {
      type: SchemaActions.SCHEMA_UPDATE_SETTINGS,
      path: 'siteName',
      value: 'Acme'
    });
    expect(named.settings.siteName).toBe('Acme');

    const coloured = SchemaReducer(named, {
      type: SchemaActions.SCHEMA_UPDATE_SETTINGS,
      path: 'themeColor',
      value: { light: '#fbf7f0', dark: '#0b0a10' }
    });
    expect(coloured.settings.themeColor).toEqual({ light: '#fbf7f0', dark: '#0b0a10' });

    expect(
      SchemaReducer(named, { type: SchemaActions.SCHEMA_UPDATE_SETTINGS, path: 'head', value: '<script>' }).settings
    ).not.toHaveProperty('head');
  });
});
