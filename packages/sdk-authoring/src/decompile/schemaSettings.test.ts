import { describe, expectTypeOf, it } from 'vitest';

import type { SCHEMA_SETTINGS } from './specFromSpace';
import type { Schema } from '@plitzi/sdk-shared';

describe('SCHEMA_SETTINGS', () => {
  // If this stops compiling, a setting was added to `Schema['settings']` and the reader would drop it as unknown.
  it('names every setting a schema can carry', () => {
    expectTypeOf<Exclude<keyof Schema['settings'], (typeof SCHEMA_SETTINGS)[number]>>().toEqualTypeOf<never>();
  });
});
