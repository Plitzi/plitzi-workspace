import { describe, expect, it } from 'vitest';

import { descendants } from '@plitzi/sdk-schema/helpers/elementTree';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import SchemaReducer from '@plitzi/sdk-schema/SchemaReducer';

import { elementSourceTypes } from '../elements';
import { authorSpace, authorSnippet, validateSpace, validateSnippet } from './index';

import type { ElementSpec, SnippetSpec } from './index';
import type { Element, Schema, Snippet } from '@plitzi/sdk-shared';

const text = (content: string, extra: Partial<ElementSpec> = {}): ElementSpec => ({
  type: 'text',
  attributes: { content },
  ...extra
});

const container = (children: ElementSpec[], extra: Partial<ElementSpec> = {}): ElementSpec => ({
  type: 'container',
  attributes: { subType: 'div' },
  children,
  ...extra
});

const minimal = (overrides: Partial<SnippetSpec> = {}): SnippetSpec => ({
  name: 'Pricing card',
  description: 'A card with a price and a call to action.',
  classes: { card: { desktop: { display: 'flex', padding: '24px' } } },
  root: container([text('$19'), text('per month')], { class: 'card' }),
  ...overrides
});

describe('authorSnippet', () => {
  it('produces a manifest the validator accepts', () => {
    const { snippet, warnings } = authorSnippet(minimal());

    expect(snippet.definition.name).toBe('Pricing card');
    expect(snippet.definition.description).toBe('A card with a price and a call to action.');
    expect(Object.keys(snippet.schema.flat)).toHaveLength(3);
    expect(warnings).toEqual([]);
  });

  it('carries no page, and roots the subtree on its base element', () => {
    const { snippet } = authorSnippet(minimal());
    const { baseElementId } = snippet.definition;
    const base = snippet.schema.flat[baseElementId];

    expect(Object.keys(snippet.schema).toSorted()).toEqual(['flat', 'variables']);
    expect(Object.values(snippet.schema.flat).some(element => element.definition.type === 'page')).toBe(false);
    expect(base.definition.parentId).toBeUndefined();
    expect(Object.values(snippet.schema.flat).every(element => element.definition.rootId === baseElementId)).toBe(true);
  });

  it('carries the classes its subtree names', () => {
    const { snippet } = authorSnippet(minimal());

    expect(snippet.style.platform.desktop.card.attributes.base.default).toMatchObject({ 'padding-top': '24px' });
    expect(snippet.style.cache).toContain('.card');
  });

  it('is deterministic — the same declaration authors a byte-identical manifest', () => {
    expect(JSON.stringify(authorSnippet(minimal()).snippet)).toBe(JSON.stringify(authorSnippet(minimal()).snippet));
  });

  it('refuses a class the subtree names and the snippet does not declare', () => {
    expect(() => authorSnippet(minimal({ classes: {} }))).toThrow(/does not declare/);
  });

  /**
   * The whole point of the artefact: what it produces has to survive the path a builder drags it through, which
   * regenerates every id and re-parents the root.
   */
  it('survives the instantiation path a builder drops it through', () => {
    const { snippet } = authorSnippet(minimal());
    const cloned = FlatMap.cloneElements(snippet.schema.flat, snippet.definition.baseElementId);

    expect(cloned.item).toBeDefined();
    expect(Object.keys(cloned.acum)).toHaveLength(3);
    expect(cloned.item?.id).not.toBe(snippet.definition.baseElementId);
    expect(cloned.item?.definition.styleSelectors.base).toBe('card');
  });
});

describe('validateSnippet', () => {
  const authored = (overrides: Partial<SnippetSpec> = {}): Snippet => authorSnippet(minimal(overrides)).snippet;

  it('reads a snippet the builder cut out of a space as it reads an authored one', () => {
    const { schema, style } = authorSpace({
      name: 'Shop',
      permanentUrl: 'shop',
      classes: { card: { desktop: { padding: '8px' } } },
      pages: [{ name: 'Home', slug: '', body: [container([text('Hi')], { id: 'card', class: 'card' })] }]
    });
    // What `BuilderProvider` uploads from "Save as snippet": the subtree, its rules and its variables, and no more.
    const { elements, elementsStyle, variables } = FlatMap.flatAsSnippet(schema, style, 'card');
    const cut: Snippet = {
      definition: { name: 'Card', description: '', baseElementId: elements.item?.id ?? '' },
      schema: { flat: elements.acum, variables },
      style: elementsStyle
    };

    expect(validateSnippet(cut)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('warns about the one class of a stacked selector the snippet does not carry, and only that one', () => {
    const snippet = authored();
    const base = snippet.schema.flat[snippet.definition.baseElementId];
    base.definition.styleSelectors.base = `${base.definition.styleSelectors.base} ghost`;
    const warned = validateSnippet(snippet)
      .warnings.filter(warning => warning.code === 'SNIPPET_SELECTOR_NOT_CARRIED')
      .map(warning => warning.message);

    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('names the class "ghost"');
  });

  it('carries a snippet whose root wears several classes', () => {
    const { snippet, warnings } = authorSnippet(
      minimal({
        classes: { card: { padding: '24px' }, raised: { 'box-shadow': '0 1px 2px black' } },
        root: container([text('$19')], { class: ['card', 'raised'] })
      })
    );

    expect(snippet.schema.flat[snippet.definition.baseElementId].definition.styleSelectors.base).toBe('card raised');
    expect(warnings).toEqual([]);
  });

  it('refuses a base element that is not in the schema', () => {
    const snippet = authored();
    const result = validateSnippet({ ...snippet, definition: { ...snippet.definition, baseElementId: 'nope' } });

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.code)).toContain('SNIPPET_MISSING_BASE');
  });

  it('refuses a base element that answers to a parent', () => {
    const snippet = authored();
    const { baseElementId } = snippet.definition;
    const base = snippet.schema.flat[baseElementId];
    const withParent: Snippet = {
      ...snippet,
      schema: {
        ...snippet.schema,
        flat: {
          ...snippet.schema.flat,
          [baseElementId]: { ...base, definition: { ...base.definition, parentId: 'somewhere-else' } }
        }
      }
    };

    expect(validateSnippet(withParent).errors.map(error => error.code)).toContain('SNIPPET_BASE_NOT_ROOT');
  });

  it('refuses a page inside a snippet', () => {
    const snippet = authored();
    const [first] = Object.values(snippet.schema.flat);
    const withPage: Snippet = {
      ...snippet,
      schema: {
        ...snippet.schema,
        flat: {
          ...snippet.schema.flat,
          [first.id]: { ...first, definition: { ...first.definition, type: 'page' } }
        }
      }
    };

    expect(validateSnippet(withPage).errors.map(error => error.code)).toContain('SNIPPET_CONTAINS_PAGE');
  });

  /** The failure a snippet author cannot see: the provider stays behind and the binding is dead on arrival. */
  it('refuses a binding onto a provider outside the subtree', () => {
    const snippet = authored();
    const { baseElementId } = snippet.definition;
    const [childId] = snippet.schema.flat[baseElementId].definition.items ?? [];
    const child = snippet.schema.flat[childId];
    const bound: Snippet = {
      ...snippet,
      schema: {
        ...snippet.schema,
        flat: {
          ...snippet.schema.flat,
          [childId]: {
            ...child,
            definition: {
              ...child.definition,
              bindings: { attributes: [{ id: 'b1', to: 'content', source: 'apiContainer_posts.title' }] }
            }
          }
        }
      }
    };

    // Read with the source catalogue too, which makes the same binding a name the structural pass cannot resolve: the
    // one problem is told once, by the reading that says what to do about it.
    for (const result of [validateSnippet(bound), validateSnippet(bound, { sourceTypes: elementSourceTypes })]) {
      expect(result.valid).toBe(false);
      expect(result.errors.map(error => error.code)).toEqual(['SNIPPET_BINDING_OUT_OF_SCOPE']);
    }
  });

  it('leaves a binding onto a global alone — the space registers those, whichever space it is', () => {
    const snippet = authored();
    const { baseElementId } = snippet.definition;
    const [childId] = snippet.schema.flat[baseElementId].definition.items ?? [];
    const child = snippet.schema.flat[childId];
    const bound: Snippet = {
      ...snippet,
      schema: {
        ...snippet.schema,
        flat: {
          ...snippet.schema.flat,
          [childId]: {
            ...child,
            definition: {
              ...child.definition,
              bindings: { attributes: [{ id: 'b1', to: 'content', source: 'auth.user.firstName' }] }
            }
          }
        }
      }
    };

    expect(validateSnippet(bound).valid).toBe(true);
  });

  /** A class named and not carried renders unstyled, and only the author can tell that from an empty selector. */
  it('warns about a class the snippet names but does not carry', () => {
    const snippet = authored();
    const stripped: Snippet = {
      ...snippet,
      style: { ...snippet.style, platform: { desktop: {}, tablet: {}, mobile: {} } }
    };

    const result = validateSnippet(stripped);

    expect(result.valid).toBe(true);
    expect(result.warnings.map(warning => warning.code)).toContain('SNIPPET_SELECTOR_NOT_CARRIED');
  });

  it('says nothing about an element whose own selector simply carries no rules', () => {
    const { warnings } = authorSnippet(minimal({ classes: {}, root: container([text('Plain')]) }));

    expect(warnings.map(warning => warning.code)).not.toContain('SNIPPET_SELECTOR_NOT_CARRIED');
  });
});

/**
 * The path a manifest actually travels, with nothing mocked but the drag itself.
 *
 * A snippet is fetched as JSON, carried as authored through the drag (`useDragElement`) and the drop
 * (`BuilderProvider`), and inserted by the schema reducer — which is the one place that renames anything, and only
 * the names the receiving space already holds. Worth holding authoring and instantiating together in a test: a
 * manifest that is perfectly consistent with itself can still land as nothing at all.
 */
describe('a snippet, dropped into a space', () => {
  const host = () =>
    authorSpace({
      name: 'Host',
      permanentUrl: 'host',
      pages: [{ name: 'Home', slug: '', body: [container([text('Existing')])] }]
    });

  const droppedInto = (snippet: Snippet, space: Schema) => {
    const [pageId] = space.pages;

    // `fetchManifest` — a manifest arrives as JSON and nothing else.
    const manifest = JSON.parse(JSON.stringify(snippet)) as Snippet;

    // `useDragElement`: the base element travels beside its descendants rather than among them, as authored.
    const baseElement = manifest.schema.flat[manifest.definition.baseElementId];
    const elements = Object.fromEntries(
      descendants(manifest.schema.flat, baseElement.id).map(id => [id, manifest.schema.flat[id]])
    );

    // `BuilderProvider`: re-rooted on the page it is being dropped into.
    const item: Element = {
      ...baseElement,
      definition: { ...baseElement.definition, rootId: pageId, parentId: pageId }
    };
    const initialItems = Object.fromEntries(
      Object.values(elements).map(el => [el.id, { ...el, definition: { ...el.definition, rootId: pageId } }])
    );

    const schema = SchemaReducer(space, {
      type: 'SCHEMA_ADD_SNIPPET',
      to: pageId,
      data: item,
      dropPosition: 'inside',
      initialItems,
      variables: manifest.schema.variables
    });

    // The reducer renames whatever the space already answers to, so the id it landed under is the page's newest
    // child rather than the one the manifest carried.
    const items = schema.flat[pageId].definition.items ?? [];

    return { schema, pageId, itemId: items[items.length - 1] };
  };

  it('lands as a subtree of the page, and leaves the space valid', () => {
    const { snippet } = authorSnippet(minimal());
    const { schema: space, style } = host();
    const { schema, pageId, itemId } = droppedInto(snippet, space);

    expect(schema.flat[pageId].definition.items).toContain(itemId);
    expect(Object.keys(schema.flat)).toHaveLength(6);
    expect(validateSpace({ schema, style }).valid).toBe(true);
  });

  /**
   * The names it brought are not free in the space it lands in. Both documents were authored, so both number their
   * refs per type from one — and two elements sharing a name is refused element by element, which is a drag that
   * appears to work and drops nothing.
   */
  it('is renamed against the space it lands in, rather than refused', () => {
    const { snippet } = authorSnippet(minimal());
    const { schema: space } = host();
    const { schema } = droppedInto(snippet, space);
    const refs = Object.values(schema.flat).map(element => element.id);

    expect(new Set(refs).size).toBe(refs.length);
    expect(refs).toContain('container-1');
    expect(refs).toContain('container-2');
  });

  it('brings its whole subtree, re-rooted on the page', () => {
    const { snippet } = authorSnippet(minimal());
    const { schema: space } = host();
    const { schema, pageId, itemId } = droppedInto(snippet, space);
    const children = schema.flat[itemId].definition.items ?? [];

    expect(children).toHaveLength(2);
    expect(children.every(childId => schema.flat[childId].definition.rootId === pageId)).toBe(true);
    expect(children.map(childId => schema.flat[childId].definition.styleSelectors.base)).toEqual(
      Object.values(snippet.schema.flat)
        .filter(element => element.definition.parentId)
        .map(element => element.definition.styleSelectors.base)
    );
  });
});
