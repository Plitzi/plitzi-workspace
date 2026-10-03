import { describe, expect, it } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';

import fitSnippet from './fitSnippet';
import SchemaReducer, { SchemaActions } from '../SchemaReducer';

import type { Element, Schema, SchemaVariable, SnippetStyle, Style, StyleItem } from '@plitzi/sdk-shared';

const element = (id: string, type: string, parentId?: string, items?: string[], base = ''): Element => ({
  id,
  attributes: {},
  definition: {
    label: id,
    type,
    rootId: 'home',
    ...(parentId ? { parentId } : {}),
    ...(items ? { items } : {}),
    styleSelectors: { base }
  }
});

const rule = (name: string, padding: string, extra: Partial<StyleItem> = {}): StyleItem => ({
  name,
  type: 'class',
  attributes: { base: { default: { 'padding-top': padding } } },
  cache: `.${name}{padding:${padding}}`,
  ...extra
});

const desktop = (items: Record<string, StyleItem>): Style['platform'] => ({ desktop: items, tablet: {}, mobile: {} });

const spaceStyle = { platform: desktop({ card: rule('card', '8px'), text: rule('text', '0', { type: 'element' }) }) };

const fitted = (style: SnippetStyle) =>
  fitSnippet(
    { schema: space(), style: spaceStyle },
    {
      data: element('promo', 'container', 'home', ['label'], 'card'),
      initialItems: { label: element('label', 'text', 'promo', [], 'title') },
      style
    }
  );

const space = (): Schema => ({
  ...EMPTY_SCHEMA.schema,
  pages: ['home'],
  flat: { home: element('home', 'page', undefined, ['hero']), hero: element('hero', 'container', 'home', []) }
});

const hero = () => ({
  data: element('hero', 'container', 'home', ['cta']),
  initialItems: { cta: element('cta', 'button', 'hero') }
});

const dropped = (schema: Schema, { data, initialItems }: { data: Element; initialItems: Record<string, Element> }) =>
  SchemaReducer(schema, {
    type: SchemaActions.SCHEMA_ADD_SNIPPET,
    to: 'home',
    data,
    dropPosition: 'inside',
    initialItems
  });

describe('fitSnippet', () => {
  it('renames only the names the document already holds, and repoints them', () => {
    const { data, initialItems } = fitSnippet({ schema: space(), style: spaceStyle }, hero());

    expect(data.id).not.toBe('hero');
    expect(Object.keys(initialItems)).toEqual(['cta']);
    expect(initialItems.cta.definition.parentId).toBe(data.id);
  });

  it('leaves what it was given alone', () => {
    const arriving = hero();
    fitSnippet({ schema: space(), style: spaceStyle }, arriving);

    expect(arriving.data.id).toBe('hero');
  });

  it('is what lets the same snippet land twice', () => {
    const once = dropped(space(), fitSnippet({ schema: space(), style: spaceStyle }, hero()));
    const twice = dropped(once, fitSnippet({ schema: once, style: spaceStyle }, hero()));

    expect(twice.flat.home.definition.items).toHaveLength(3);
  });

  it('renames a class the space uses for something else, on the rule and on every element that wears it', () => {
    const { data, style } = fitted({ platform: desktop({ card: rule('card', '24px') }) });
    const renamed = style?.platform.desktop['card-2'];

    expect(data.definition.styleSelectors.base).toBe('card-2');
    expect(Object.keys(style?.platform.desktop ?? {})).toEqual(['card-2']);
    // Recompiled: the CSS a page loads names the new class, and never the space's own `.card`.
    expect(renamed?.cache).toContain('.card-2');
    expect(renamed?.cache).not.toMatch(/\.card(?!-2)/);
  });

  it('shares a class that says the same in both, as a duplicated element does', () => {
    const { data, style } = fitted({ platform: desktop({ card: rule('card', '8px') }) });

    expect(data.definition.styleSelectors.base).toBe('card');
    expect(Object.keys(style?.platform.desktop ?? {})).toEqual(['card']);
  });

  it('repoints a rule that names a renamed class as its ancestor, and recompiles it', () => {
    const title = rule('title', '0', { attributes: { base: { ancestors: { card: { default: { color: 'red' } } } } } });
    const { initialItems, style } = fitted({ platform: desktop({ card: rule('card', '24px'), title }) });
    const repointed = style?.platform.desktop.title;

    expect(initialItems.label.definition.styleSelectors.base).toBe('title');
    expect(Object.keys(repointed?.attributes.base.ancestors ?? {})).toEqual(['card-2']);
    expect(repointed?.cache).toContain('.card-2');
  });

  it('never renames the rule for an element type, which the space keeps', () => {
    const { style } = fitted({ platform: desktop({ text: rule('text', '99px', { type: 'element' }) }) });

    expect(Object.keys(style?.platform.desktop ?? {})).toEqual(['text']);
  });
});

const accent: SchemaVariable = { name: 'accent', category: 'colors', type: 'color', value: 'red', subValues: [] };

describe('SCHEMA_ADD_SNIPPET', () => {
  it('refuses a name already taken, as the server does, and brings no variable with it', () => {
    const schema = space();
    const refused = SchemaReducer(schema, {
      type: SchemaActions.SCHEMA_ADD_SNIPPET,
      to: 'home',
      dropPosition: 'inside',
      ...hero(),
      variables: [accent]
    });

    expect(refused.flat.home.definition.items).toEqual(['hero']);
    expect(refused.variables).toEqual([]);
  });
});
