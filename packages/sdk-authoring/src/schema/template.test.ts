import { describe, expect, it } from 'vitest';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import SchemaReducer from '@plitzi/sdk-schema/SchemaReducer';

import { authorSpace, authorTemplate, validateSpace, validateTemplate } from './index';

import type { ElementSpec, TemplateSpec } from './index';
import type { Element, Schema, Template } from '@plitzi/sdk-shared';

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

const minimal = (overrides: Partial<TemplateSpec> = {}): TemplateSpec => ({
  name: 'Pricing card',
  description: 'A card with a price and a call to action.',
  classes: { card: { desktop: { display: 'flex', padding: '24px' } } },
  root: container([text('$19'), text('per month')], { class: 'card' }),
  ...overrides
});

describe('authorTemplate', () => {
  it('produces a manifest the validator accepts', () => {
    const { template, warnings } = authorTemplate(minimal());

    expect(template.definition.name).toBe('Pricing card');
    expect(template.definition.description).toBe('A card with a price and a call to action.');
    expect(Object.keys(template.schema.flat)).toHaveLength(3);
    expect(warnings).toEqual([]);
  });

  it('carries no page, and roots the subtree on its base element', () => {
    const { template } = authorTemplate(minimal());
    const { baseElementId } = template.definition;
    const base = template.schema.flat[baseElementId];

    expect(template.schema.pages).toEqual([]);
    expect(Object.values(template.schema.flat).some(element => element.definition.type === 'page')).toBe(false);
    expect(base.definition.parentId).toBeUndefined();
    expect(Object.values(template.schema.flat).every(element => element.definition.rootId === baseElementId)).toBe(
      true
    );
  });

  it('carries the classes its subtree names', () => {
    const { template } = authorTemplate(minimal());

    expect(template.style.platform.desktop.card.attributes.base.default).toMatchObject({ 'padding-top': '24px' });
    expect(template.style.cache).toContain('.card');
  });

  it('is deterministic — the same declaration authors a byte-identical manifest', () => {
    expect(JSON.stringify(authorTemplate(minimal()).template)).toBe(JSON.stringify(authorTemplate(minimal()).template));
  });

  it('refuses a class the subtree names and the template does not declare', () => {
    expect(() => authorTemplate(minimal({ classes: {} }))).toThrow(/does not declare/);
  });

  /**
   * The whole point of the artefact: what it produces has to survive the path a builder drags it through, which
   * regenerates every id and re-parents the root.
   */
  it('survives the instantiation path a builder drops it through', () => {
    const { template } = authorTemplate(minimal());
    const cloned = FlatMap.cloneElements(template.schema.flat, template.definition.baseElementId);

    expect(cloned.item).toBeDefined();
    expect(Object.keys(cloned.acum)).toHaveLength(3);
    expect(cloned.item?.id).not.toBe(template.definition.baseElementId);
    expect(cloned.item?.definition.styleSelectors.base).toBe('card');
  });
});

describe('validateTemplate', () => {
  const authored = (overrides: Partial<TemplateSpec> = {}): Template => authorTemplate(minimal(overrides)).template;

  it('refuses a base element that is not in the schema', () => {
    const template = authored();
    const result = validateTemplate({ ...template, definition: { ...template.definition, baseElementId: 'nope' } });

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.code)).toContain('TEMPLATE_MISSING_BASE');
  });

  it('refuses a base element that answers to a parent', () => {
    const template = authored();
    const { baseElementId } = template.definition;
    const base = template.schema.flat[baseElementId];
    const withParent: Template = {
      ...template,
      schema: {
        ...template.schema,
        flat: {
          ...template.schema.flat,
          [baseElementId]: { ...base, definition: { ...base.definition, parentId: 'somewhere-else' } }
        }
      }
    };

    expect(validateTemplate(withParent).errors.map(error => error.code)).toContain('TEMPLATE_BASE_NOT_ROOT');
  });

  it('refuses a page inside a template', () => {
    const template = authored();
    const [first] = Object.values(template.schema.flat);
    const withPage: Template = {
      ...template,
      schema: {
        ...template.schema,
        flat: {
          ...template.schema.flat,
          [first.id]: { ...first, definition: { ...first.definition, type: 'page' } }
        }
      }
    };

    expect(validateTemplate(withPage).errors.map(error => error.code)).toContain('TEMPLATE_CONTAINS_PAGE');
  });

  /** The failure a template author cannot see: the provider stays behind and the binding is dead on arrival. */
  it('refuses a binding onto a provider outside the subtree', () => {
    const template = authored();
    const { baseElementId } = template.definition;
    const [childId] = template.schema.flat[baseElementId].definition.items ?? [];
    const child = template.schema.flat[childId];
    const bound: Template = {
      ...template,
      schema: {
        ...template.schema,
        flat: {
          ...template.schema.flat,
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

    const result = validateTemplate(bound);

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.code)).toContain('TEMPLATE_BINDING_OUT_OF_SCOPE');
  });

  it('leaves a binding onto a global alone — the space registers those, whichever space it is', () => {
    const template = authored();
    const { baseElementId } = template.definition;
    const [childId] = template.schema.flat[baseElementId].definition.items ?? [];
    const child = template.schema.flat[childId];
    const bound: Template = {
      ...template,
      schema: {
        ...template.schema,
        flat: {
          ...template.schema.flat,
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

    expect(validateTemplate(bound).valid).toBe(true);
  });

  /** A class named and not carried renders unstyled, and only the author can tell that from an empty selector. */
  it('warns about a class the template names but does not carry', () => {
    const template = authored();
    const stripped: Template = {
      ...template,
      style: { ...template.style, platform: { desktop: {}, tablet: {}, mobile: {} } }
    };

    const result = validateTemplate(stripped);

    expect(result.valid).toBe(true);
    expect(result.warnings.map(warning => warning.code)).toContain('TEMPLATE_SELECTOR_NOT_CARRIED');
  });

  it('says nothing about an element whose own selector simply carries no rules', () => {
    const { warnings } = authorTemplate(minimal({ classes: {}, root: container([text('Plain')]) }));

    expect(warnings.map(warning => warning.code)).not.toContain('TEMPLATE_SELECTOR_NOT_CARRIED');
  });
});

/**
 * The path a manifest actually travels, with nothing mocked but the drag itself.
 *
 * A template is fetched as JSON, carried as authored through the drag (`useDragElement`) and the drop
 * (`BuilderProvider`), and inserted by the schema reducer — which is the one place that renames anything, and only
 * the names the receiving space already holds. Worth holding authoring and instantiating together in a test: a
 * manifest that is perfectly consistent with itself can still land as nothing at all.
 */
describe('a template, dropped into a space', () => {
  const host = () =>
    authorSpace({
      name: 'Host',
      permanentUrl: 'host',
      pages: [{ name: 'Home', slug: '', body: [container([text('Existing')])] }]
    });

  const droppedInto = (template: Template, space: Schema) => {
    const [pageId] = space.pages;

    // `fetchManifest` — a manifest arrives as JSON and nothing else.
    const manifest = JSON.parse(JSON.stringify(template)) as Template;

    // `useDragElement`: the base element travels beside its descendants rather than among them, as authored.
    const baseElement = manifest.schema.flat[manifest.definition.baseElementId];
    const elements = Object.fromEntries(
      FlatMap.childTree(manifest.schema.flat, baseElement.id).map(id => [id, manifest.schema.flat[id]])
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
      type: 'SCHEMA_ADD_TEMPLATE',
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
    const { template } = authorTemplate(minimal());
    const { schema: space, style } = host();
    const { schema, pageId, itemId } = droppedInto(template, space);

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
    const { template } = authorTemplate(minimal());
    const { schema: space } = host();
    const { schema } = droppedInto(template, space);
    const refs = Object.values(schema.flat).map(element => element.id);

    expect(new Set(refs).size).toBe(refs.length);
    expect(refs).toContain('container-1');
    expect(refs).toContain('container-2');
  });

  it('brings its whole subtree, re-rooted on the page', () => {
    const { template } = authorTemplate(minimal());
    const { schema: space } = host();
    const { schema, pageId, itemId } = droppedInto(template, space);
    const children = schema.flat[itemId].definition.items ?? [];

    expect(children).toHaveLength(2);
    expect(children.every(childId => schema.flat[childId].definition.rootId === pageId)).toBe(true);
    expect(children.map(childId => schema.flat[childId].definition.styleSelectors.base)).toEqual(
      Object.values(template.schema.flat)
        .filter(element => element.definition.parentId)
        .map(element => element.definition.styleSelectors.base)
    );
  });
});
