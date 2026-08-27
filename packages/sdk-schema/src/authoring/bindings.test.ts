import { describe, expect, it } from 'vitest';

import { authorSpace, GLOBAL_SOURCES, resolveSource, withVisibility } from './index';

import type { SourceIndex } from './index';

const index: SourceIndex = new Map([
  ['posts', 'apiContainer'],
  // A form publishes under `apiContainer`, not under `form`. That is the whole reason this resolution exists.
  ['signup', 'apiContainer'],
  ['postList', 'list']
]);

const resolve = (source: string): string => resolveSource(source, index, 'Element "text"');

describe('resolveSource', () => {
  it('fills in the prefix the element publishes under', () => {
    expect(resolve('posts.title')).toBe('apiContainer_posts.title');
    expect(resolve('postList.item.name')).toBe('list_postList.item.name');
  });

  it('fills it in for an element whose source name is not its own type', () => {
    expect(resolve('signup.values')).toBe('apiContainer_signup.values');
  });

  it('resolves a bare idRef with no field', () => {
    expect(resolve('posts')).toBe('apiContainer_posts');
  });

  it('leaves the globals as they are', () => {
    for (const global of GLOBAL_SOURCES) {
      expect(resolve(`${global}.something`)).toBe(`${global}.something`);
    }
  });

  it('leaves a source already written in full alone', () => {
    expect(resolve('apiContainer_posts.title')).toBe('apiContainer_posts.title');
  });

  /**
   * The trap this closes. `form_signup` names an element that exists, spelled the way its own type reads, and
   * resolves to nothing — a form registers as `apiContainer_signup`. Before the catalog reached here it was
   * accepted, and the element bound to it simply rendered its placeholder forever.
   */
  it('refuses a prefix that is not what the element publishes', () => {
    expect(() => resolve('form_signup.values')).toThrow(/publishes its source as "apiContainer_signup"/);
  });

  it('refuses a name nothing answers to, and suggests the one meant', () => {
    expect(() => resolve('psots.title')).toThrow(/nothing in this space answers to "psots".*did you mean "posts"/);
    expect(() => resolve('apiContainer_psots.title')).toThrow(/no element answers to the idRef "psots"/);
  });
});

describe('withVisibility', () => {
  it('appends the condition after the bindings the element declared', () => {
    const bindings = withVisibility({ bind: { href: 'posts.url' }, visible: 'posts.hasPosts' });

    expect(bindings).toEqual([
      { to: 'href', source: 'posts.url' },
      { to: 'visibility', source: 'posts.hasPosts', category: 'initialState' }
    ]);
  });

  /**
   * One field with a `!` rather than a `visible`/`hidden` pair: `hidden` is a real HTML attribute (NodeHtml carries
   * it), and in this surface the attribute keeps a name it shares with anything else. A type test fails the build
   * if an authoring field ever collides with one — which is how this design was settled.
   */
  it('reads a leading ! as the inverse', () => {
    expect(withVisibility({ visible: '!posts.hasPosts' })).toEqual([
      {
        to: 'visibility',
        source: 'posts.hasPosts',
        category: 'initialState',
        transformers: [{ action: 'not', params: {} }]
      }
    ]);
  });

  it('leaves an element with no condition exactly as it was', () => {
    expect(withVisibility({ bind: { href: 'posts.url' } })).toEqual([{ to: 'href', source: 'posts.url' }]);
    expect(withVisibility({})).toBeUndefined();
  });
});

describe('an element whose visibility is a condition', () => {
  /**
   * The failure this pins: a binding on a source that resolves to nothing writes nothing, and an absent
   * `visibility` is read as VISIBLE. So a panel bound to a selection nobody has made was authored on screen with
   * its placeholder text in it, and only disappeared once something happened.
   */
  it('is authored hidden, and left visible when it has no condition', () => {
    const { schema } = authorSpace({
      name: 'Conditional',
      permanentUrl: 'conditional',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            { type: 'text', idRef: 'always' },
            { type: 'text', idRef: 'waiting', visible: 'state.selected.id' }
          ]
        }
      ]
    });

    const visibilityOf = (idRef: string) =>
      Object.values(schema.flat).find(element => element.idRef === idRef)?.definition.initialState?.visibility;

    expect(visibilityOf('always')).toBe(true);
    expect(visibilityOf('waiting')).toBe(false);
  });
});
