import { describe, expect, it } from 'vitest';

import { authorSpace, container } from '../index';

import type { ComponentSpec } from '../index';

// A project in JavaScript, or one nobody type-checks, still hears of a prop type that does not exist.
describe('a component prop’s type', () => {
  it('is refused, with the types there are, when it is none of them', () => {
    // Read off untyped code: the type system would have said so, and this is the check for when it is not there.
    const card = JSON.parse(
      JSON.stringify({ id: 'card', props: { title: { type: 'string', description: 'Its title' } } })
    ) as Omit<ComponentSpec, 'root'>;

    expect(() =>
      authorSpace({
        name: 'Props',
        permanentUrl: 'props',
        components: [{ ...card, root: container({ id: 'card-root' }) }],
        pages: [{ id: 'home', name: 'Home', slug: '', body: [] }]
      })
    ).toThrow(/declares the prop "title" as `string`, which is no type.*words are `text`/);
  });
});
