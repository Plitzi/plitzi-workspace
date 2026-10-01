import { describe, expect, it } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';

import {
  addComponent,
  detachInstance,
  documentIds,
  flatMapOf,
  instancesOf,
  removeComponent,
  renameElement,
  treeOf,
  updateComponent
} from './components';
import { validateSchema } from './schemaValidator';

import type { Element, Schema, SpaceComponent } from '@plitzi/sdk-shared';

const element = (id: string, type: string, rootId: string, parentId?: string, items?: string[]): Element => ({
  id,
  attributes: {},
  definition: {
    label: id,
    type,
    rootId,
    ...(parentId ? { parentId } : {}),
    ...(items ? { items } : {}),
    styleSelectors: { base: id }
  }
});

/** A page holding a card (title and an actions area), and a component `badge` declared beside it. */
const document = (): Schema => ({
  ...structuredClone(EMPTY_SCHEMA.schema),
  pages: ['home'],
  flat: {
    home: { ...element('home', 'page', 'home', undefined, ['card']), attributes: { default: true } },
    card: element('card', 'container', 'home', 'home', ['card-title', 'card-actions']),
    'card-title': element('card-title', 'text', 'home', 'card'),
    'card-actions': element('card-actions', 'container', 'home', 'card', [])
  },
  components: {
    badge: {
      id: 'badge',
      rootId: 'badge-root',
      flat: { 'badge-root': element('badge-root', 'text', 'badge-root') }
    }
  }
});

const instance = (id: string, componentId: string, parentId: string, rootId: string, items: string[] = []) => ({
  ...element(id, 'reference', rootId, parentId, items),
  attributes: { referenceType: 'component', referenceId: componentId }
});

describe('the trees of a document', () => {
  it('finds the tree an id is in, and holds a map over it to the ids of every other tree', () => {
    const schema = document();

    expect(treeOf(schema, 'card')?.componentId).toBeUndefined();
    expect(treeOf(schema, 'badge-root')?.componentId).toBe('badge');
    expect(documentIds(schema)).toEqual(new Set(['home', 'card', 'card-title', 'card-actions', 'badge-root']));

    // `badge-root` is free in the pages' tree and taken in the document.
    const map = flatMapOf(schema, 'card');
    expect(map?.addElement(element('badge-root', 'text', 'home'), 'card')).toBe(false);
    expect(map?.addElement(element('subtitle', 'text', 'home'), 'card')).toBe(true);
    expect(schema.flat.subtitle.definition.parentId).toBe('card');
  });
});

describe('addComponent', () => {
  it('makes a component of a subtree and leaves an instance where it was', () => {
    const schema = document();

    expect(
      addComponent(
        schema,
        { id: 'card', label: 'Card', rootId: '', flat: {} },
        {
          elementId: 'card',
          instanceId: 'card-1'
        }
      )
    ).toBe(true);

    const card = schema.components.card;
    expect(card.rootId).toBe('card');
    expect(Object.keys(card.flat).sort()).toEqual(['card', 'card-actions', 'card-title']);
    expect(card.flat.card.definition.parentId).toBeUndefined();
    expect(card.flat['card-title'].definition.rootId).toBe('card');
    expect(schema.flat.home.definition.items).toEqual(['card-1']);
    expect(schema.flat['card-1'].attributes).toEqual({ referenceType: 'component', referenceId: 'card' });
    expect(validateSchema(schema).errors).toEqual([]);
  });

  it('refuses a name already taken, and an instance name the document holds', () => {
    const schema = document();

    expect(addComponent(schema, { id: 'badge', rootId: '', flat: {} }, { elementId: 'card', instanceId: 'c1' })).toBe(
      false
    );
    expect(addComponent(schema, { id: 'card', rootId: '', flat: {} }, { elementId: 'card', instanceId: 'home' })).toBe(
      false
    );
    expect(schema.flat.card).toBeDefined();
  });

  it('refuses a declaration its tree does not bear out, changing nothing', () => {
    const schema = document();
    const before = structuredClone(schema);

    expect(
      addComponent(
        schema,
        { id: 'card', rootId: '', flat: {}, slots: ['nowhere'] },
        { elementId: 'card', instanceId: 'c1' }
      )
    ).toBe(false);
    expect(
      addComponent(
        schema,
        { id: 'card', rootId: '', flat: {}, props: { referenceId: { type: 'text', description: '' } } },
        { elementId: 'card', instanceId: 'c1' }
      )
    ).toBe(false);
    expect(schema).toEqual(before);
  });

  it('declares a component that brings its own tree, refusing one whose ids the document holds', () => {
    const schema = document();
    const empty: SpaceComponent = { id: 'tile', rootId: 'tile', flat: { tile: element('tile', 'container', 'tile') } };

    expect(addComponent(schema, empty)).toBe(true);
    expect(
      addComponent(schema, { id: 'other', rootId: 'card', flat: { card: element('card', 'container', 'card') } })
    ).toBe(false);
  });
});

describe('updateComponent and removeComponent', () => {
  it('changes the declaration only when its tree bears it out', () => {
    const schema = document();

    expect(
      updateComponent(schema, 'badge', { label: 'Badge', props: { text: { type: 'text', description: '' } } })
    ).toBe(true);
    expect(schema.components.badge.label).toBe('Badge');
    expect(updateComponent(schema, 'badge', { slots: ['card'] })).toBe(false);
    expect(updateComponent(schema, 'badge', { props: { 'my-text': { type: 'text', description: '' } } })).toBe(false);
    expect(updateComponent(schema, 'ghost', { label: 'Ghost' })).toBe(false);
  });

  it('refuses to remove a component something still places', () => {
    const schema = document();
    schema.flat['card-actions'].definition.items = ['badge-1'];
    schema.flat['badge-1'] = instance('badge-1', 'badge', 'card-actions', 'home');

    expect(instancesOf(schema, 'badge').map(found => found.id)).toEqual(['badge-1']);
    expect(removeComponent(schema, 'badge')).toBe(false);

    delete schema.flat['badge-1'];
    schema.flat['card-actions'].definition.items = [];

    expect(removeComponent(schema, 'badge')).toBe(true);
    expect(schema.components).toEqual({});
  });
});

describe('detachInstance', () => {
  it('replaces the instance with a copy of the component, its slot filled with what filled the instance', () => {
    const schema = document();
    addComponent(
      schema,
      { id: 'card', rootId: '', flat: {}, slots: ['card-actions'] },
      {
        elementId: 'card',
        instanceId: 'card-1'
      }
    );
    schema.flat['card-1'].definition.items = ['buy'];
    schema.flat.buy = { ...element('buy', 'button', 'home', 'card-1'), attributes: { slot: 'card-actions' } };

    const root = detachInstance(schema, 'card-1');

    expect(root).toBe('card-2');
    expect(schema.flat['card-1']).toBeUndefined();
    expect(schema.flat.home.definition.items).toEqual(['card-2']);
    expect(schema.flat['card-2'].definition.items).toEqual(['card-title-2', 'card-actions-2']);
    expect(schema.flat['card-actions-2'].definition.items).toEqual(['buy']);
    expect(schema.flat.buy.definition.parentId).toBe('card-actions-2');
    expect(schema.flat.buy.attributes.slot).toBeUndefined();
    expect(schema.flat['card-title-2'].definition.rootId).toBe('home');
    // The component is untouched: other instances still render it.
    expect(Object.keys(schema.components.card.flat).sort()).toEqual(['card', 'card-actions', 'card-title']);
    expect(validateSchema(schema).errors).toEqual([]);
  });
});

describe('renameElement', () => {
  it('renames an element of a component, with the slot it is and the children that name it', () => {
    const schema = document();
    addComponent(
      schema,
      { id: 'card', rootId: '', flat: {}, slots: ['card-actions'] },
      {
        elementId: 'card',
        instanceId: 'card-1'
      }
    );
    schema.flat['card-1'].definition.items = ['buy'];
    schema.flat.buy = { ...element('buy', 'button', 'home', 'card-1'), attributes: { slot: 'card-actions' } };

    expect(renameElement(schema, 'card-actions', 'footer')).not.toBe(false);
    expect(schema.components.card.slots).toEqual(['footer']);
    expect(schema.components.card.flat.footer.definition.parentId).toBe('card');
    expect(schema.flat.buy.attributes.slot).toBe('footer');

    expect(renameElement(schema, 'card', 'tile')).not.toBe(false);
    expect(schema.components.card.rootId).toBe('tile');
  });

  it('refuses a name another tree holds', () => {
    const schema = document();

    expect(renameElement(schema, 'card', 'badge-root')).toBe(false);
  });
});

describe('validating components', () => {
  const placed = (): Schema => {
    const schema = document();
    schema.flat['card-actions'].definition.items = ['badge-1'];
    schema.flat['badge-1'] = instance('badge-1', 'badge', 'card-actions', 'home');

    return schema;
  };

  it('accepts a document whose components are whole and placed', () => {
    expect(validateSchema(placed()).errors).toEqual([]);
  });

  it('refuses an id used in two trees', () => {
    const schema = placed();
    schema.components.badge.flat.card = element('card', 'text', 'badge-root', 'badge-root');
    schema.components.badge.flat['badge-root'].definition.items = ['card'];

    expect(validateSchema(schema).errors.map(error => error.code)).toContain('DUPLICATE_ELEMENT_ID');
  });

  it('holds a component to its own tree: a binding onto the page it is placed on names nothing', () => {
    const schema = placed();
    schema.flat.provider = element('provider', 'apiContainer', 'home', 'home', []);
    schema.flat.home.definition.items?.push('provider');
    schema.components.badge.flat['badge-root'].definition.bindings = {
      attributes: [{ id: 'b1', to: 'content', source: 'apiContainer_provider.data' }]
    };

    const { errors } = validateSchema(schema, { sourceTypes: { apiContainer: 'apiContainer' } });
    const unresolved = errors.find(error => error.code === 'UNRESOLVED_BINDING_SOURCE');
    expect(unresolved?.componentId).toBe('badge');
  });

  it('refuses components that place each other in a circle', () => {
    const schema = placed();
    schema.components.badge.flat['badge-root'] = {
      ...element('badge-root', 'container', 'badge-root', undefined, ['badge-again'])
    };
    schema.components.badge.flat['badge-again'] = instance('badge-again', 'badge', 'badge-root', 'badge-root');

    expect(validateSchema(schema).errors.map(error => error.code)).toContain('COMPONENT_CYCLE');
  });
});
