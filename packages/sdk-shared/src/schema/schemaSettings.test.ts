import { describe, expect, expectTypeOf, it } from 'vitest';

import { isSchemaSetting } from './schemaSettings';

import type { SCHEMA_SETTINGS } from './schemaSettings';
import type { Schema } from '../types';

describe('SCHEMA_SETTINGS', () => {
  // If this stops compiling, a setting was added to `Schema['settings']`: the builder would drop it, the reader too.
  it('names every setting a schema can carry', () => {
    expectTypeOf<Exclude<keyof Schema['settings'], (typeof SCHEMA_SETTINGS)[number]>>().toEqualTypeOf<never>();
  });

  // The builder wrote a setting only where the space already had a value for it: a new one — a site's name — was lost.
  it('says a setting the space has no value for yet, and nothing else', () => {
    expect(isSchemaSetting('siteName')).toBe(true);
    expect(isSchemaSetting('head')).toBe(false);
  });
});
