import { describe, expectTypeOf, it } from 'vitest';

import type { ELEMENT_FIELDS, SPACE_FIELDS } from './specToSource';
import type { ElementSpec, SpaceSpec } from '../schema';

describe('what the emitter writes', () => {
  // If this stops compiling, the authoring surface grew a field the emitter does not know yet, and every export would
  // drop it without a word. Add it to ELEMENT_FIELDS / SPACE_FIELDS in `specToSource.ts` — nothing else is needed.
  it('names every field of an element spec and of a space spec', () => {
    expectTypeOf<Exclude<keyof ElementSpec, (typeof ELEMENT_FIELDS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof SpaceSpec, (typeof SPACE_FIELDS)[number]>>().toEqualTypeOf<never>();
  });
});
