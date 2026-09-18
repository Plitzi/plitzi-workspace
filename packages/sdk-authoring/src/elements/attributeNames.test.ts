import { describe, expectTypeOf, it } from 'vitest';

import type { elementAttributeNames } from './attributeNames';
import type { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';
import type { AttributesOf } from '@plitzi/sdk-shared/authoring/declare';

type Declared = {
  [Name in keyof typeof elementDeclarations as (typeof elementDeclarations)[Name]['type']]: AttributesOf<
    (typeof elementDeclarations)[Name]
  >;
};

type Listed = typeof elementAttributeNames;

/** An element type whose list says something other than its attribute type: names missing, or names it does not have. */
type Mismatched = {
  [Type in keyof Declared]: Type extends keyof Listed
    ? Listed[Type] extends readonly (infer Name)[]
      ? [Exclude<keyof Declared[Type], Name>, Exclude<Name, keyof Declared[Type]>] extends [never, never]
        ? never
        : Type
      : string extends keyof Declared[Type]
        ? never
        : Type
    : Type;
}[keyof Declared];

describe('elementAttributeNames', () => {
  // If this stops compiling, an element's attributes changed and the data did not: `yarn generate:attribute-names`.
  it('lists exactly the attributes each element type declares', () => {
    expectTypeOf<Mismatched>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof Listed, keyof Declared>>().toEqualTypeOf<never>();
  });
});
