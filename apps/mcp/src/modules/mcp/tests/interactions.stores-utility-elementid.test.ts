import { describe, expect, it } from 'vitest';

import { buildSpace, capturing, checkBatch } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';
import { clickTrigger, interactiveSpace } from './interactionsHelpers';

import type { Space } from '../helpers';
import type { Operation } from '../tools';
import type { ComponentCatalog } from '@plitzi/sdk-shared';

// --- Dynamic per-space catalog: strict for default (custom:false) types, lenient for plugins (custom:true) ---
const spaceWithCatalog = (catalog: ComponentCatalog): Space => ({ ...interactiveSpace(), catalog });
const setStateFlow = (params: Record<string, unknown>, elementId?: string): Operation => ({
  type: 'upsertInteractionFlow',
  pageRef: 'home',
  ref: 'b1',
  nodes: [
    { nodeType: 'trigger', action: 'onClick', title: 'Click' },
    { nodeType: 'callback', action: 'setState', title: 'Set', params, ...(elementId ? { elementId } : {}) }
  ]
});
// --- Value-type validation: a param of the WRONG type on a strict built-in catalog is a hard error, so a node
// that is malformed by a wrong data type (not just an unknown key) is caught. ---
const notifyFlow = (params: Record<string, unknown>): Operation => ({
  type: 'upsertInteractionFlow',
  pageRef: 'home',
  ref: 'c1',
  nodes: [
    { nodeType: 'trigger', action: 'onClick', title: 'Click' },
    { nodeType: 'globalCallback', action: 'addNotification', title: 'Notify', params: { content: 'Hi', ...params } }
  ]
});

describe('MCP interactions', () => {
  // A utility is resolved by its action alone (`utility[action]`) — it is registered on NO element, so its stored
  // elementId must be null, never the host. The agent commonly (and wrongly) pins delayTime to the host button.
  it('stores a utility elementId as null even when the agent points it at the host element', async () => {
    const cap = capturing(interactiveSpace());
    await apply(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              // The agent wrongly pins the utility to the host element; the tool must null it.
              { nodeType: 'utility', action: 'delayTime', title: 'Wait', params: { time: 2000 }, elementId: 'c1' }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'utility' && n.action === 'delayTime'
    );
    expect(node?.elementId).toBeNull();
  });
  it('normalizes a stringified nullish elementId ("undefined") on a patched utility to null', async () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      ...clickTrigger('delayTime-1'),
      'delayTime-1': {
        id: 'delayTime-1',
        title: 'Wait 2 seconds',
        type: 'utility',
        action: 'delayTime',
        params: { time: 1500 },
        preview: {},
        // The builder writes the literal string "undefined" here — a known artifact.
        elementId: 'undefined',
        beforeNode: 'onClick-1',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true
      }
    };
    const cap = capturing(space);
    await apply(
      {
        operations: [{ type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: 'delayTime-1', title: 'Wait' }]
      },
      cap.saved(),
      cap.persisters
    );
    expect(cap.saved().schema.flat.c1.definition.interactions?.['delayTime-1'].elementId).toBeNull();
  });
  // Touching the node fixes what was already wrong with it, where that has one reading — and says so.
  it('fixes, and says it fixed, a utility node that carries a real (host) elementId, on patch', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      ...clickTrigger('delayTime-1'),
      'delayTime-1': {
        id: 'delayTime-1',
        title: 'Wait',
        type: 'utility',
        action: 'delayTime',
        params: { time: 2000 },
        preview: {},
        elementId: 'c1',
        beforeNode: 'onClick-1',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true
      }
    };
    const res = checkBatch(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: 'delayTime-1', title: 'Renamed' }
        ]
      },
      space
    );
    expect(res.valid).toBe(true);
    expect(
      res.warnings.some(w => w.startsWith('Fixed a pre-existing problem in element "c1"') && w.includes('delayTime'))
    ).toBe(true);
  });
  it('fixes, and says it fixed, a literal string "undefined" elementId (stringified nullish, a builder artifact)', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      ...clickTrigger('delayTime-1'),
      'delayTime-1': {
        id: 'delayTime-1',
        title: 'Wait',
        type: 'utility',
        action: 'delayTime',
        params: { time: 2000 },
        preview: {},
        elementId: 'undefined',
        beforeNode: 'onClick-1',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true
      }
    };
    const res = checkBatch(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: 'delayTime-1', title: 'Renamed' }
        ]
      },
      space
    );
    expect(res.valid).toBe(true);
    expect(
      res.warnings.some(w => w.startsWith('Fixed a pre-existing problem in element "c1"') && w.includes('delayTime'))
    ).toBe(true);
  });
  // Refused — no element answers it, so the step would do nothing — and the warning names the node type that fixes it.
  it('refuses a global callback used with nodeType "callback" and names the right node type', () => {
    const res = checkBatch(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'callback', action: 'addNotification', title: 'Notify', params: { content: 'Hi' } }
            ]
          }
        ]
      },
      interactiveSpace()
    );
    expect(res.valid).toBe(false);
    expect(
      res.warnings.some(
        w => w.includes('addNotification') && w.includes('global callback') && w.includes('globalCallback')
      )
    ).toBe(true);
  });
  it('warns when a utility is used with nodeType "globalCallback" (wrong node type)', () => {
    const res = checkBatch(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'globalCallback', action: 'delayTime', title: 'Wait', params: { time: 100 } }
            ]
          }
        ]
      },
      interactiveSpace()
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('delayTime') && w.includes('utility'))).toBe(true);
  });
  it('exposes element callbacks and utilities with their param schema in the interactions catalog', () => {
    const catalog = readResource(buildSpace(), 'main', 'plitzi://interactions/main')?.data as {
      elementCallbacks: { action: string; params: { name: string }[] }[];
      utilities: { action: string; params: { name: string }[] }[];
    };
    const setState = catalog.elementCallbacks.find(c => c.action === 'setState');
    expect(setState?.params.map(p => p.name)).toEqual(['category', 'key', 'value', 'revertOnFinish']);
    const delay = catalog.utilities.find(c => c.action === 'delayTime');
    expect(delay?.params.map(p => p.name)).toEqual(['time']);
  });
  // A setState with no key writes nothing: the step runs and nothing changes, so it does not get saved.
  it('refuses an element setState missing its key', () => {
    const res = checkBatch({ operations: [setStateFlow({ value: 'x' })] }, interactiveSpace());
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('setState') && e.message.includes('needs "key"'))).toBe(true);
  });
  it('refuses a setState attribute key the built-in target never reads; a real key passes', () => {
    const ok = checkBatch(
      { operations: [setStateFlow({ category: 'attribute', key: 'content', value: 'x' })] },
      interactiveSpace()
    );
    expect(ok.valid).toBe(true);

    const bad = checkBatch(
      { operations: [setStateFlow({ category: 'attribute', key: 'bogus', value: 'x' })] },
      interactiveSpace()
    );
    expect(bad.valid).toBe(false);
    expect(bad.errors.some(e => e.message.includes('"button"') && e.message.includes('"bogus"'))).toBe(true);
  });
  // Only this deployment's manifest knows a plugin's attributes, and it is a best-effort snapshot.
  it('only WARNS on a bad setState key for a plugin target type', () => {
    const space = spaceWithCatalog({ myWidget: { custom: true, attributes: ['title'], styleSelectors: ['base'] } });
    space.schema.flat.w1 = {
      id: 'w1',
      attributes: { title: 'Weather' },
      definition: {
        rootId: 'home',
        parentId: 'home',
        label: 'Widget',
        type: 'myWidget',
        items: [],
        styleSelectors: { base: '' }
      }
    };
    space.schema.flat.home.definition.items = [...(space.schema.flat.home.definition.items ?? []), 'w1'];

    const res = checkBatch(
      { operations: [setStateFlow({ category: 'attribute', key: 'bogus', value: 'x' }, 'w1')] },
      space
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('myWidget') && w.includes('bogus'))).toBe(true);
  });
  it('validates category="state" keys against the type visibility + styleSelectors', () => {
    const ok = checkBatch(
      { operations: [setStateFlow({ category: 'state', key: 'styleSelectors.base', value: 'true' })] },
      interactiveSpace()
    );
    expect(ok.valid).toBe(true);

    const bad = checkBatch(
      { operations: [setStateFlow({ category: 'state', key: 'styleSelectors.nope', value: 'true' })] },
      interactiveSpace()
    );
    expect(bad.valid).toBe(false);
  });
  it('ERRORS on an unknown attribute of a default type, WARNS for a plugin type (upsertElement)', () => {
    const upsert: Operation = {
      type: 'upsertElement',
      pageRef: 'home',
      parentRef: 'home',
      position: 'inside',
      element: { ref: 'w-1', type: 'container', props: { bogus: 1 } }
    };
    const strict = checkBatch(
      { operations: [upsert] },
      spaceWithCatalog({ container: { custom: false, attributes: ['title'] } })
    );
    expect(strict.valid).toBe(false);
    expect(strict.errors.some(e => e.message.includes('container') && e.message.includes('bogus'))).toBe(true);

    const lenient = checkBatch(
      { operations: [{ ...upsert, element: { ref: 'w-1', type: 'myWidget', props: { bogus: 1 } } }] },
      spaceWithCatalog({ myWidget: { custom: true, attributes: ['title'] } })
    );
    expect(lenient.valid).toBe(true);
    expect(lenient.warnings.some(w => w.includes('bogus'))).toBe(true);
  });
  it('lists a catalog type with zero instances in plitzi://types with its attributes/slots and source', () => {
    const space = {
      ...buildSpace(),
      catalog: {
        gauge: {
          custom: true,
          label: 'Gauge',
          category: 'widget',
          attributes: ['min', 'max'],
          styleSelectors: ['track']
        }
      } as ComponentCatalog
    };
    const reg = readResource(space, 'main', 'plitzi://types')?.data as {
      types: Record<string, { source: string; props: Record<string, unknown>; slots: string[] }>;
    };
    expect(reg.types.gauge.source).toBe('plugin');
    expect(Object.keys(reg.types.gauge.props).sort()).toEqual(['max', 'min']);
    expect(reg.types.gauge.slots).toContain('track');
  });
  it('ERRORS on a non-numeric value for a number param, but ACCEPTS a numeric string (text input)', () => {
    const bad = checkBatch({ operations: [notifyFlow({ autoDismissTimeout: 'soon' })] }, interactiveSpace());
    expect(bad.valid).toBe(false);
    expect(bad.errors.some(e => e.message.includes('autoDismissTimeout') && e.message.includes('number'))).toBe(true);

    // The builder's number fields are text inputs, so a numeric string ("5000") is legitimate and coerces at runtime.
    const ok = checkBatch({ operations: [notifyFlow({ autoDismissTimeout: '5000' })] }, interactiveSpace());
    expect(ok.valid).toBe(true);
  });
  it('ERRORS on a boolean param given as a string', () => {
    const res = checkBatch({ operations: [notifyFlow({ autoDismiss: 'true' })] }, interactiveSpace());
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('autoDismiss') && e.message.includes('boolean'))).toBe(true);
  });
  it('ERRORS on a select param value outside its options and lists the allowed values', () => {
    const res = checkBatch({ operations: [notifyFlow({ appearance: 'bogus' })] }, interactiveSpace());
    expect(res.valid).toBe(false);
    const err = res.errors.find(e => e.message.includes('appearance'));
    expect(err?.message).toContain('success');
  });
  // `value` is a `scalar` param: its data type follows the target attribute (a boolean attribute stores a real
  // boolean, a number a real number), so none of these is a type error.
  it('accepts a scalar setState value of any primitive type (boolean / number / string)', () => {
    const flow = (value: unknown): Operation => ({
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'b1',
      nodes: [
        { nodeType: 'trigger', action: 'onClick', title: 'Click' },
        {
          nodeType: 'callback',
          action: 'setState',
          title: 'Set',
          params: { category: 'attribute', key: 'content', value }
        }
      ]
    });
    expect(checkBatch({ operations: [flow(true)] }, interactiveSpace()).valid).toBe(true);
    expect(checkBatch({ operations: [flow(5)] }, interactiveSpace()).valid).toBe(true);
    expect(checkBatch({ operations: [flow('Hola')] }, interactiveSpace()).valid).toBe(true);
  });
  // --- patchInteractionNode validates the MERGED node (stored params ∪ the patch), not only the keys touched: a
  // half-fixed node — one param corrected, another still malformed — is caught. ---
  it('re-validates the whole merged node on patch, catching a malformed param the patch did not touch', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      ...clickTrigger('delayTime-bad'),
      'delayTime-bad': {
        id: 'delayTime-bad',
        title: 'Notify',
        type: 'globalCallback',
        action: 'addNotification',
        params: { content: 'Hi', autoDismissTimeout: 'soon' },
        preview: {},
        elementId: 'space',
        beforeNode: 'onClick-1',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true
      }
    };
    const res = checkBatch(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: 'delayTime-bad', title: 'Renamed' }
        ]
      },
      space
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('autoDismissTimeout') && e.message.includes('number'))).toBe(true);
  });
  it('drops leftover unknown params (delay/time) on the node it patches, and says so', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      'setState-1': {
        id: 'setState-1',
        title: 'Set loading text',
        type: 'callback',
        action: 'setState',
        params: { key: 'content', value: 'probando...', category: 'attribute', delay: null, time: null },
        preview: {},
        elementId: 'c1',
        beforeNode: '',
        afterNode: '',
        flowId: 'setState-1',
        enabled: true
      }
    };
    const res = checkBatch(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: 'setState-1', params: { value: 'nuevo' } }
        ]
      },
      space
    );
    const fixed = res.warnings.filter(w => w.startsWith('Fixed a pre-existing problem in element "c1"'));
    expect(fixed.some(w => w.includes('"delay"'))).toBe(true);
    expect(fixed.some(w => w.includes('"time"'))).toBe(true);
  });
  // The whole point: a patch whose OWN fields are correct must still be REJECTED (and NOT persisted) while the node
  // it lands on stays malformed — the agent has to fix the malformation too before the save goes through.
  it('blocks the save when a valid patch lands on an already-malformed node, and persists nothing', async () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      ...clickTrigger('delayTime-bad'),
      'delayTime-bad': {
        id: 'delayTime-bad',
        title: 'Notify',
        type: 'globalCallback',
        action: 'addNotification',
        params: { content: 'Hi', autoDismissTimeout: 'soon' },
        preview: {},
        elementId: 'space',
        beforeNode: 'onClick-1',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true
      }
    };
    const cap = capturing(space);
    const res = await apply(
      {
        operations: [
          {
            type: 'patchInteractionNode',
            pageRef: 'home',
            ref: 'c1',
            nodeId: 'delayTime-bad',
            params: { content: 'Nuevo contenido' }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(false);
    expect(res.persisted).toBe(false);
    expect(res.errors?.some(e => e.message.includes('autoDismissTimeout') && e.message.includes('number'))).toBe(true);
    // The correct new field was NOT written, because the node as a whole is still malformed.
    expect(cap.saved().schema.flat.c1.definition.interactions?.['delayTime-bad'].params.content).toBe('Hi');
  });
});
