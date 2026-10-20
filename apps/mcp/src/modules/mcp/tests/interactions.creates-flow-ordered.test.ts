import { describe, expect, it } from 'vitest';

import { buildSpace, capturing, checkBatch } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';
import { interactiveSpace } from './interactionsHelpers';

import type { Operation } from '../tools';
import type { AIElementDetail } from '../types';

const flowOp: Operation = {
  type: 'upsertInteractionFlow',
  pageRef: 'home',
  ref: 'c1',
  nodes: [
    { nodeType: 'trigger', action: 'onClick', title: 'Click' },
    { nodeType: 'globalCallback', action: 'login', title: 'Log in', params: { mode: 'token' } }
  ]
};

describe('MCP interactions', () => {
  it('creates a flow from ordered steps and reads it back in order', async () => {
    const cap = capturing(interactiveSpace());
    const res = await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);
    expect(res.summary.created).toBe(1);
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    const flow = el.interactions?.[0];
    expect(flow?.nodes.map(n => n.action)).toEqual(['onClick', 'login']);
    expect(flow?.flowId).toBe(flow?.nodes[0].id);
  });
  it('wires a flow onto the element by the name it answers to', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [{ ...flowOp, ref: 'c1' }] }, cap.saved(), cap.persisters);
    expect(res.applied).toBe(true);
    // The trigger is registered under the element's one name.
    const elementName = cap.saved().schema.flat.c1.id;
    expect(elementName).toBe('c1');
    const trigger = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'trigger'
    );
    expect(trigger?.elementId).toBe(elementName);
  });
  it('patches one node and deletes a single step, re-linking the flow', async () => {
    const cap = capturing(interactiveSpace());
    const created = await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);
    const el0 = created.elements?.[0] as AIElementDetail;
    const callbackId = el0.interactions?.[0].nodes[1].id ?? '';

    await apply(
      {
        operations: [{ type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: callbackId, title: 'Renamed' }]
      },
      cap.saved(),
      cap.persisters
    );
    let el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.interactions?.[0].nodes[1].title).toBe('Renamed');

    await apply(
      { operations: [{ type: 'deleteInteraction', pageRef: 'home', ref: 'c1', nodeId: callbackId }] },
      cap.saved(),
      cap.persisters
    );
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.interactions?.[0].nodes.map(n => n.action)).toEqual(['onClick']);
  });
  // The runtime registers an element's callbacks under its name and looks them up by that same key — one key, so a
  // node can only ever be pinned to the right one.
  it('targets a node at the element name, which is the key the runtime registers callbacks under', async () => {
    const space = buildSpace();
    const cap = capturing(space);

    await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);

    const stored = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {});
    expect(stored).not.toHaveLength(0);

    const trigger = stored.find(node => node.type === 'trigger');
    expect(trigger?.elementId).toBe('c1');
  });
  /**
   * The other half of the same rule, and the half that used to be wrong.
   *
   * A global callback is registered by its SOURCE MODULE, so `login` resolves as `auth.login` and never as
   * `<host element>.login`. It landed on the host for as long as the catalog declared the action under a name
   * nothing registered — the step was written onto a page that renders perfectly and did nothing when pressed.
   */
  it('targets a global callback at its source module, never at the host element', async () => {
    const cap = capturing(buildSpace());

    await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);

    const stored = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {});
    const callback = stored.find(node => node.action === 'login');

    expect(callback?.elementId).toBe('auth');
  });
  it('targets a sibling element by its name, which is the key the runtime resolves it by', async () => {
    const space = interactiveSpace();
    space.schema.flat.c2 = {
      id: 'c2',
      attributes: {},
      definition: {
        rootId: 'home',
        parentId: 'home',
        label: 'Modal',
        type: 'modalContainer',
        items: [],
        styleSelectors: { base: '' }
      }
    };
    space.schema.flat.home.definition.items = ['c1', 'c2'];
    const cap = capturing(space);

    const res = await apply(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'callback', action: 'openModal', title: 'Open', elementId: 'c2' }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const callback = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'callback'
    );
    expect(callback?.elementId).toBe('c2');
  });
  it('rejects a flow whose first node is not a trigger', () => {
    const res = checkBatch(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [{ nodeType: 'callback', action: 'login', title: 'Log in' }]
          }
        ]
      },
      buildSpace()
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('trigger'))).toBe(true);
  });
  it('rejects deleteInteraction without exactly one of flowId/nodeId', () => {
    const res = checkBatch({ operations: [{ type: 'deleteInteraction', pageRef: 'home', ref: 'c1' }] }, buildSpace());
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('exactly one'))).toBe(true);
  });
  // A globalCallback is registered on its source module, not the host element — the built-in catalog pins elementId
  // to the source and fills the builder's param defaults for the keys the agent omits.
  it('routes a built-in globalCallback to its source module and fills param defaults', async () => {
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
              { nodeType: 'globalCallback', action: 'addNotification', title: 'Notify', params: { content: 'Saved!' } }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.action === 'addNotification'
    );
    expect(node?.elementId).toBe('space');
    expect(node?.params).toMatchObject({
      content: 'Saved!',
      placement: 'top-right',
      appearance: 'success',
      autoDismiss: true,
      autoDismissTimeout: 5000
    });
  });
  it('skips a conditional default when its guard fails (autoDismiss:false omits the timeout)', async () => {
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
              {
                nodeType: 'globalCallback',
                action: 'addNotification',
                title: 'Notify',
                params: { content: 'Hi', autoDismiss: false }
              }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.action === 'addNotification'
    );
    expect(node?.params.autoDismiss).toBe(false);
    expect(node?.params).not.toHaveProperty('autoDismissTimeout');
  });
  // A param value can be a data-binding token ({{ source }}) that resolves at runtime — so its literal string form is
  // NOT a type error even for a param declared boolean/number (autoDismiss/autoDismissTimeout here).
  it('accepts a data-binding token as a param value where the type would otherwise be boolean/number', () => {
    const res = checkBatch(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              {
                nodeType: 'globalCallback',
                action: 'addNotification',
                title: 'Notify',
                params: {
                  content: '{{ list_food-list.item.name }}',
                  autoDismiss: '{{ list_food-list.item.pinned }}',
                  autoDismissTimeout: '{{ list_food-list.item.ttl }}'
                }
              }
            ]
          }
        ]
      },
      interactiveSpace()
    );
    expect(res.errors.some(e => e.message.includes('autoDismiss'))).toBe(false);
    expect(res.errors.some(e => e.message.includes('autoDismissTimeout'))).toBe(false);
  });
  it('warns when a built-in globalCallback is pointed at the host element instead of its source', () => {
    const res = checkBatch(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'globalCallback', action: 'addNotification', title: 'Notify', elementId: 'c1' }
            ]
          }
        ]
      },
      interactiveSpace()
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('addNotification') && w.includes('"space"'))).toBe(true);
  });
  it('exposes built-in globalCallbacks with their source and full param schema in the interactions catalog', () => {
    const catalog = readResource(buildSpace(), 'main', 'plitzi://interactions/main')?.data as {
      globalCallbacks: {
        action: string;
        source: string;
        strictParams: boolean;
        params: { name: string; type: string; description: string; default?: unknown; options?: string[] }[];
      }[];
    };
    const notify = catalog.globalCallbacks.find(c => c.action === 'addNotification');
    expect(notify?.source).toBe('space');
    expect(notify?.strictParams).toBe(true);
    const paramNames = notify?.params.map(p => p.name);
    expect(paramNames).toEqual(['content', 'placement', 'appearance', 'autoDismiss', 'autoDismissTimeout']);
    expect(paramNames).not.toContain('title');
    expect(paramNames).not.toContain('message');
    expect(notify?.params.find(p => p.name === 'autoDismiss')?.default).toBe(true);
    expect(catalog.globalCallbacks.find(c => c.action === 'navigate')?.source).toBe('navigation');
  });
  it('drops unknown params on a strict built-in callback and keeps the real content field', async () => {
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
              {
                nodeType: 'globalCallback',
                action: 'addNotification',
                title: 'Notify',
                params: { title: 'Hola!', message: 'Hola a todos', type: 'success', content: 'Real body' }
              }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.action === 'addNotification'
    );
    expect(node?.params).not.toHaveProperty('title');
    expect(node?.params).not.toHaveProperty('message');
    expect(node?.params).not.toHaveProperty('type');
    expect(node?.params.content).toBe('Real body');
  });
  it('warns when a strict built-in callback gets unknown params', () => {
    const res = checkBatch(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              {
                nodeType: 'globalCallback',
                action: 'addNotification',
                title: 'Notify',
                params: { message: 'Hola', content: 'Body' }
              }
            ]
          }
        ]
      },
      interactiveSpace()
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('addNotification') && w.includes('"message"'))).toBe(true);
  });
  // The element `setState` callback (nodeType "callback") changes the element's own attribute/state and fills its
  // builder defaults (category:"attribute", revertOnFinish:false). It is a DIFFERENT thing from the global state
  // setState (nodeType "globalCallback") even though they share the name.
  it('fills the element setState defaults and keeps it on the host element', async () => {
    const cap = capturing(interactiveSpace());
    await apply(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'b1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              {
                nodeType: 'callback',
                action: 'setState',
                title: 'Loading label',
                params: { key: 'content', value: 'Loading…', revertOnFinish: true }
              }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const node = Object.values(cap.saved().schema.flat.b1.definition.interactions ?? {}).find(
      n => n.type === 'callback' && n.action === 'setState'
    );
    expect(node?.elementId).toBe('b1');
    expect(node?.params).toMatchObject({
      category: 'attribute',
      key: 'content',
      value: 'Loading…',
      revertOnFinish: true
    });
  });
  it('drops the global-schema `type` param leaked onto the element setState and warns', async () => {
    const op: Operation = {
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'b1',
      nodes: [
        { nodeType: 'trigger', action: 'onClick', title: 'Click' },
        {
          nodeType: 'callback',
          action: 'setState',
          title: 'Disable',
          params: { key: 'disabled', type: 'boolean', value: 'true' }
        }
      ]
    };
    const res = checkBatch({ operations: [op] }, interactiveSpace());
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('setState') && w.includes('"type"'))).toBe(true);

    const cap = capturing(interactiveSpace());
    await apply({ operations: [op] }, cap.saved(), cap.persisters);
    const node = Object.values(cap.saved().schema.flat.b1.definition.interactions ?? {}).find(
      n => n.type === 'callback' && n.action === 'setState'
    );
    expect(node?.params).not.toHaveProperty('type');
    expect(node?.params).toMatchObject({ category: 'attribute', key: 'disabled', value: 'true' });
  });
  // The global state setState (nodeType "globalCallback") keeps its own schema (key/type/value) and routes to source
  // "state" — the two setStates must not be conflated.
  it('routes the global setState to source "state" with its own key/type/value schema', async () => {
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
              {
                nodeType: 'globalCallback',
                action: 'setState',
                title: 'Set global state',
                params: { key: 'count', type: 'number', value: '1' }
              }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'globalCallback' && n.action === 'setState'
    );
    expect(node?.elementId).toBe('state');
    expect(node?.params).toMatchObject({ key: 'count', type: 'number', value: '1' });
  });
  it('warns and drops the wrong `delay` param on the delayTime utility (the key is `time`)', async () => {
    const op: Operation = {
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'c1',
      nodes: [
        { nodeType: 'trigger', action: 'onClick', title: 'Click' },
        { nodeType: 'utility', action: 'delayTime', title: 'Wait', params: { delay: 2000 } }
      ]
    };
    const res = checkBatch({ operations: [op] }, interactiveSpace());
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('delayTime') && w.includes('"delay"') && w.includes('time'))).toBe(true);

    const cap = capturing(interactiveSpace());
    await apply({ operations: [op] }, cap.saved(), cap.persisters);
    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'utility' && n.action === 'delayTime'
    );
    expect(node?.params).not.toHaveProperty('delay');
  });
});
