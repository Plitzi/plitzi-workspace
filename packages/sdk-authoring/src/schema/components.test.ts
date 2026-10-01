import { describe, expect, it } from 'vitest';

import { authorSpace, button, component, container, heading, specFromSpace, specToSource, text } from '../index';

import type { ComponentSpec, SpaceSpec } from './types';

/** A card that takes a title, may be wide, and has an area its instances fill with actions. */
const card: ComponentSpec = {
  id: 'card',
  label: 'Card',
  props: {
    title: { type: 'text', description: 'The heading', required: true },
    wide: { type: 'boolean', description: 'Spans the row', default: false }
  },
  slots: ['card-actions'],
  root: container({
    id: 'card-root',
    children: [heading({ id: 'card-title', bind: { content: 'props.title' } }), container({ id: 'card-actions' })]
  })
};

const space = (body: SpaceSpec['pages'][number]['body'], components: ComponentSpec[] = [card]): SpaceSpec => ({
  name: 'Cards',
  permanentUrl: 'cards',
  components,
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

describe('authoring components', () => {
  it('writes a component’s tree beside the pages, never into them, and an instance where it is placed', () => {
    const { schema } = authorSpace(
      space([component('card', { id: 'lamp', props: { title: 'Lamp' }, children: [button({ content: 'Buy' })] })])
    );

    expect(Object.keys(schema.components)).toEqual(['card']);
    expect(schema.components.card.rootId).toBe('card-root');
    expect(Object.keys(schema.components.card.flat).sort()).toEqual(['card-actions', 'card-root', 'card-title']);
    expect(schema.components.card.flat['card-root'].definition.parentId).toBeUndefined();
    expect(schema.flat['card-title']).toBeUndefined();
    expect(schema.flat.lamp.attributes).toMatchObject({
      referenceType: 'component',
      referenceId: 'card',
      title: 'Lamp'
    });
    expect(schema.components.card.flat['card-title'].definition.bindings?.attributes?.[0].source).toBe('props.title');
  });

  it('refuses a component the space does not declare, naming the ones it does', () => {
    expect(() => authorSpace(space([component('crad', { props: { title: 'Lamp' } })]))).toThrow(
      /places component "crad", which this space does not declare.*did you mean "card"/is
    );
  });

  it('refuses a prop the component does not declare, a required one left out, and a value of the wrong kind', () => {
    expect(() => authorSpace(space([component('card', { props: { title: 'Lamp', subtitle: 'x' } })]))).toThrow(
      /"subtitle", which it does not declare/
    );
    expect(() => authorSpace(space([component('card')]))).toThrow(/without "title", which it requires/);
    expect(() => authorSpace(space([component('card', { props: { title: 'Lamp', wide: 'yes' } })]))).toThrow(
      /"wide" as string, and it is declared boolean/
    );
  });

  it('takes a required prop that is bound rather than written', () => {
    expect(() =>
      authorSpace(space([component('card', { bind: [{ to: 'title', source: 'state.product' }] })]))
    ).not.toThrow();
  });

  it('refuses a child for a slot the component does not have', () => {
    expect(() =>
      authorSpace(space([component('card', { props: { title: 'Lamp' }, children: { 'card-footer': [text('x')] } })]))
    ).toThrow(/the slot "card-footer", but component "card" declares the slots "card-actions"/);
  });

  it('holds a component closed: what it binds has to be its own or a global', () => {
    const peeking: ComponentSpec = {
      ...card,
      root: container({ id: 'card-root', children: [text({ id: 'card-title', bind: { content: 'feed.data' } })] }),
      slots: []
    };

    expect(() => authorSpace(space([component('card', { props: { title: 'Lamp' } })], [peeking]))).toThrow(
      /nothing in this component answers to "feed".*comes in as a prop/s
    );
  });

  it('refuses a slot that is not an element of the component, and a prop named like an attribute it already has', () => {
    expect(() => authorSpace(space([], [{ ...card, slots: ['nowhere'] }]))).toThrow(
      /declares the slot "nowhere", which is not an element of its tree/
    );
    expect(() =>
      authorSpace(space([], [{ ...card, props: { referenceId: { type: 'text', description: '' } } }]))
    ).toThrow(/"referenceId" is an attribute every instance already has/);
  });

  it('reads a space with components back into the spec it was written from, and writes it as code', () => {
    const spec = space([
      component('card', { id: 'lamp', props: { title: 'Lamp' }, children: { 'card-actions': [button('Buy')] } })
    ]);
    const documents = authorSpace(spec);
    const { spec: read, corrections } = specFromSpace(documents);

    expect(corrections).toEqual([]);
    expect(authorSpace(read).schema).toEqual(documents.schema);

    const files = specToSource(read, { exportName: 'cards' });
    const source = Object.values(files).join('\n');
    expect(source).toMatch(/component\('card'/);
    expect(source).toMatch(/'card-actions': \[/);
  });
});
