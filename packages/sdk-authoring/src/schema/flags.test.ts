import { describe, expect, it } from 'vitest';

import { flagGateOf, flagSpecOf } from './flags';
import { compareSpaces } from '../decompile/compareSpaces';
import { specFromSpace } from '../decompile/specFromSpace';
import { authorSpace, container, lintSpace, text } from '../index';

import type { SpaceSpec } from './types';

const space: SpaceSpec = {
  name: 'Flags',
  permanentUrl: 'flags',
  flags: {
    newCheckout: {
      description: 'The one-step checkout',
      value: false,
      rules: [
        { when: { combinator: 'and', rules: [{ field: 'environment', operator: '=', value: 'staging' }] }, value: true }
      ]
    },
    labs: { value: false, rules: [] }
  },
  pages: [
    {
      name: 'Home',
      slug: '',
      body: [
        container({ id: 'checkout', flag: 'newCheckout', children: [text({ id: 'next', content: 'New' })] }),
        container({ id: 'legacy', flag: '!newCheckout', children: [text({ id: 'old', content: 'Old' })] })
      ]
    },
    { name: 'Labs', slug: 'labs', flag: 'labs', body: [text({ id: 'labs-text', content: 'Labs' })] }
  ]
};

describe('flagGateOf', () => {
  it('reads a flag that has to be on, and one that has to be off', () => {
    expect(flagGateOf('newCheckout', 'here')).toEqual({ name: 'newCheckout', is: true });
    expect(flagGateOf('!newCheckout', 'here')).toEqual({ name: 'newCheckout', is: false });
    expect(flagGateOf(undefined, 'here')).toBeUndefined();
  });

  it('refuses what names no flag, with what to write', () => {
    expect(() => flagGateOf('new checkout', 'Element "a"')).toThrow(/Element "a": `flag` is "new checkout"/);
    expect(() => flagGateOf(true, 'Element "a"')).toThrow(/flag: '!newCheckout'/);
  });

  it('is undone by flagSpecOf', () => {
    expect(flagSpecOf({ name: 'a', is: false })).toBe('!a');
    expect(flagSpecOf({ name: 'a', is: true })).toBe('a');
  });
});

describe('authoring flags', () => {
  it('writes the declarations and every gate, and lints clean', () => {
    const documents = authorSpace(space);
    const { schema } = documents;

    expect(schema.flags).toEqual(space.flags);
    expect(schema.flat.checkout.definition.flag).toEqual({ name: 'newCheckout', is: true });
    expect(schema.flat.legacy.definition.flag).toEqual({ name: 'newCheckout', is: false });
    expect(schema.flat[schema.pages[1]].definition.flag).toEqual({ name: 'labs', is: true });
    expect(lintSpace(documents)).toEqual({ errors: [], warnings: [] });
  });

  it('comes back from a document as it was written', () => {
    const documents = authorSpace(space);
    const { spec, corrections } = specFromSpace(documents);

    expect(corrections).toEqual([]);
    expect(spec.flags).toEqual(space.flags);
    expect(compareSpaces(documents, authorSpace(spec))).toEqual([]);
  });
});
