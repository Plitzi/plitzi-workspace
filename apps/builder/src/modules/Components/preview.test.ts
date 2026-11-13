import { describe, expect, it } from 'vitest';

import { placementsOf, previewOf } from './preview';

import type { Element, Schema, SpaceComponent, Style } from '@plitzi/sdk-shared';

const element = (
  id: string,
  {
    parentId,
    rootId = 'home',
    type = 'container',
    base = '',
    attributes = {},
    label
  }: Partial<{
    parentId: string;
    rootId: string;
    type: string;
    base: string;
    attributes: Element['attributes'];
    label: string;
  }> = {}
): Element => ({
  id,
  attributes,
  definition: { rootId, parentId, label: label ?? id, type, items: [], styleSelectors: { base } }
});

const instance = (id: string, parentId: string, attributes: Element['attributes'] = {}): Element =>
  element(id, {
    parentId,
    type: 'reference',
    attributes: { referenceType: 'component', referenceId: 'card', ...attributes }
  });

const card: SpaceComponent = {
  id: 'card',
  label: 'Card',
  rootId: 'card-root',
  props: {
    title: { type: 'text', description: 'Its title', default: 'A title' },
    note: { type: 'text', description: 'A note' }
  },
  flat: { 'card-root': element('card-root', { rootId: 'card-root' }) }
};

const rules = (name: string, rule: Record<string, string>) => ({
  name,
  type: 'class' as const,
  cache: '',
  attributes: { base: { default: rule } }
});

const style = {
  platform: {
    desktop: {
      dark: rules('dark', { 'background-color': '#0b0b12', color: '#ffffff' }),
      glass: rules('glass', { 'background-color': 'transparent' }),
      light: rules('light', { 'background-image': 'linear-gradient(#fff, #eee)' })
    },
    tablet: {},
    mobile: {}
  }
} as unknown as Pick<Style, 'platform'>;

const schema: Pick<Schema, 'flat' | 'components'> = {
  flat: {
    home: element('home', { type: 'page', label: 'Home' }),
    band: element('band', { parentId: 'home', base: 'dark' }),
    row: element('row', { parentId: 'band', base: 'glass' }),
    'card-1': instance('card-1', 'row', { title: 'Hosted', note: 'Ours' }),
    plain: element('plain', { parentId: 'home', base: 'light' }),
    'card-2': instance('card-2', 'plain', { title: 'Bound' })
  },
  components: { card }
};
schema.flat['card-2'].definition.bindings = { attributes: [{ id: 'title-1', to: 'title', source: 'state.name' }] };

describe('a component as one of its instances shows it', () => {
  it('lists where it is placed, by the page it is on', () => {
    expect(placementsOf(schema, 'card')).toEqual([
      { instanceId: 'card-1', where: 'Home' },
      { instanceId: 'card-2', where: 'Home' }
    ]);
  });

  // The landing's cards had white words made for a dark band: drawn on the canvas's white, the canvas was blank.
  it('draws on the nearest ground around the instance, past what paints nothing', () => {
    expect(previewOf(schema, style, card, 'card-1')).toEqual({
      props: { title: 'Hosted', note: 'Ours' },
      ground: { background: '#0b0b12', color: '#ffffff' }
    });
  });

  it('keeps the default of a prop the instance binds, which only its page resolves', () => {
    expect(previewOf(schema, style, card, 'card-2')).toEqual({
      props: { title: 'A title', note: null },
      ground: { background: 'linear-gradient(#fff, #eee)' }
    });
  });

  it('shows the first instance when none is asked for, or the one asked for is gone', () => {
    expect(previewOf(schema, style, card).props.title).toBe('Hosted');
    expect(previewOf(schema, style, card, 'gone').props.title).toBe('Hosted');
  });

  // The dashboard's tiles sit on a page whose ground is its layout's: the page itself paints none.
  it('looks for the ground in the layout the page is drawn in, around the slot that holds it', () => {
    const inLayout: Pick<Schema, 'flat' | 'components'> = {
      flat: {
        shell: element('shell', { rootId: 'shell', type: 'layoutContainer', base: 'dark' }),
        body: element('body', { rootId: 'shell', parentId: 'shell' }),
        home: element('home', { type: 'page', attributes: { layout: 'shell', layoutContainer: 'body' } }),
        'card-1': instance('card-1', 'home')
      },
      components: { card }
    };

    expect(previewOf(inLayout, style, card).ground).toEqual({ background: '#0b0b12', color: '#ffffff' });
  });

  it('falls back to the defaults on the canvas’s own ground when nothing places it', () => {
    expect(previewOf({ flat: { home: schema.flat.home }, components: { card } }, style, card)).toEqual({
      props: { title: 'A title', note: null },
      ground: {}
    });
  });
});
