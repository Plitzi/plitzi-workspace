import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { elementRefOf } from '../helpers';
import { readResource } from '../resources';
import { apply, validate } from '../tools';

import type { Space } from '../helpers';
import type { Operation } from '../tools';
import type { AIElementDetail } from '../types';
import type { ComponentCatalog } from '@plitzi/sdk-shared';

describe('mcp-ai interactions', () => {
  // Interactions are wired by idRef, so an element only takes a flow once it has one — the harness gives c1 an
  // idRef, and the flow is addressed by that ref.
  const interactiveSpace = (): Space => {
    const space = buildSpace();
    space.schema.flat.c1.idRef = 'box-1';

    return space;
  };

  const flowOp: Operation = {
    type: 'upsertInteractionFlow',
    pageRef: 'home',
    ref: 'box-1',
    nodes: [
      { nodeType: 'trigger', action: 'onClick', title: 'Click' },
      { nodeType: 'globalCallback', action: 'login', title: 'Log in', params: { mode: 'token' } }
    ]
  };

  it('creates a flow from ordered steps and reads it back in order', async () => {
    const cap = capturing(interactiveSpace());
    const res = await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);
    expect(res.summary.created).toBe(1);
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    const flow = el.interactions?.[0];
    expect(flow?.nodes.map(n => n.action)).toEqual(['onClick', 'login']);
    expect(flow?.flowId).toBe(flow?.nodes[0].id);
  });

  it('mints an idRef for an element that has none so the flow can be wired', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [{ ...flowOp, ref: 'c1' }] }, cap.saved(), cap.persisters);
    expect(res.applied).toBe(true);
    // c1 had no idRef; the flow forces one, and the trigger is registered under it.
    const idRef = cap.saved().schema.flat.c1.idRef;
    expect(idRef).toBeTruthy();
    const trigger = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'trigger'
    );
    expect(trigger?.elementId).toBe(idRef);
  });

  it('patches one node and deletes a single step, re-linking the flow', async () => {
    const cap = capturing(interactiveSpace());
    const created = await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);
    const el0 = created.elements?.[0] as AIElementDetail;
    const callbackId = el0.interactions?.[0].nodes[1].id ?? '';

    await apply(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'box-1', nodeId: callbackId, title: 'Renamed' }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    let el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.interactions?.[0].nodes[1].title).toBe('Renamed');

    await apply(
      { operations: [{ type: 'deleteInteraction', pageRef: 'home', ref: 'box-1', nodeId: callbackId }] },
      cap.saved(),
      cap.persisters
    );
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.interactions?.[0].nodes.map(n => n.action)).toEqual(['onClick']);
  });

  // The runtime registers an element's callbacks under `idRef ?? id` and looks them up by that same key, so a node
  // pinned to a raw id would resolve to nothing once the element has an idRef — the flow would silently do nothing.
  it('targets a node at the element ref, not its raw id, so the callback resolves at runtime', async () => {
    const space = buildSpace();
    space.schema.flat.c1.idRef = 'hero-box';
    const cap = capturing(space);

    await apply({ operations: [{ ...flowOp, ref: 'hero-box' }] }, cap.saved(), cap.persisters);

    const stored = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {});
    expect(stored).not.toHaveLength(0);
    stored.forEach(node => expect(node.elementId).toBe(elementRefOf(cap.saved().schema.flat.c1)));
  });

  it('rewrites a node target given as a raw id onto the ref the runtime registers', async () => {
    const space = buildSpace();
    space.schema.flat.c1.idRef = 'hero-box';
    const cap = capturing(space);

    await apply(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'hero-box',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              // An agent may address any element by its raw id; the stored node must still carry the ref.
              { nodeType: 'callback', action: 'setVisibility', title: 'Hide', elementId: 'c1' }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    const callback = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'callback'
    );
    expect(callback?.elementId).toBe('hero-box');
  });

  it('mints an idRef for a target element that has none, so the callback can reach it', async () => {
    const space = interactiveSpace();
    // A sibling with no idRef: targeting it forces one so the callback resolves at runtime.
    space.schema.flat.c2 = {
      id: 'c2',
      attributes: {},
      definition: {
        rootId: 'page1',
        parentId: 'page1',
        label: 'Bare',
        type: 'container',
        items: [],
        styleSelectors: { base: '' }
      }
    };
    space.schema.flat.page1.definition.items = ['c1', 'c2'];
    const cap = capturing(space);

    const res = await apply(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'box-1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'callback', action: 'setVisibility', title: 'Hide', elementId: 'c2' }
            ]
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const mintedRef = cap.saved().schema.flat.c2.idRef;
    expect(mintedRef).toBeTruthy();
    const callback = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'callback'
    );
    expect(callback?.elementId).toBe(mintedRef);
  });

  it('rejects a flow whose first node is not a trigger', () => {
    const res = validate(
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
    const res = validate({ operations: [{ type: 'deleteInteraction', pageRef: 'home', ref: 'c1' }] }, buildSpace());
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
            ref: 'box-1',
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
      appeareance: 'success',
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
            ref: 'box-1',
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
    const res = validate(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'box-1',
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
    const res = validate(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'box-1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'globalCallback', action: 'addNotification', title: 'Notify', elementId: 'box-1' }
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
    expect(paramNames).toEqual(['content', 'placement', 'appeareance', 'autoDismiss', 'autoDismissTimeout']);
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
            ref: 'box-1',
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
    const res = validate(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'box-1',
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
            ref: 'box-1',
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

    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'callback' && n.action === 'setState'
    );
    expect(node?.elementId).toBe('box-1');
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
      ref: 'box-1',
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
    const res = validate({ operations: [op] }, interactiveSpace());
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('setState') && w.includes('"type"'))).toBe(true);

    const cap = capturing(interactiveSpace());
    await apply({ operations: [op] }, cap.saved(), cap.persisters);
    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
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
            ref: 'box-1',
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
      ref: 'box-1',
      nodes: [
        { nodeType: 'trigger', action: 'onClick', title: 'Click' },
        { nodeType: 'utility', action: 'delayTime', title: 'Wait', params: { delay: 2000 } }
      ]
    };
    const res = validate({ operations: [op] }, interactiveSpace());
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('delayTime') && w.includes('"delay"') && w.includes('time'))).toBe(true);

    const cap = capturing(interactiveSpace());
    await apply({ operations: [op] }, cap.saved(), cap.persisters);
    const node = Object.values(cap.saved().schema.flat.c1.definition.interactions ?? {}).find(
      n => n.type === 'utility' && n.action === 'delayTime'
    );
    expect(node?.params).not.toHaveProperty('delay');
  });

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
            ref: 'box-1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              // The agent wrongly pins the utility to the host element; the tool must null it.
              { nodeType: 'utility', action: 'delayTime', title: 'Wait', params: { time: 2000 }, elementId: 'box-1' }
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
      node_u: {
        id: 'node_u',
        title: 'Wait 2 seconds',
        type: 'utility',
        action: 'delayTime',
        params: { time: 1500 },
        preview: {},
        // The builder writes the literal string "undefined" here — a known artifact.
        elementId: 'undefined',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_u',
        enabled: true
      }
    };
    const cap = capturing(space);
    await apply(
      {
        operations: [{ type: 'patchInteractionNode', pageRef: 'home', ref: 'box-1', nodeId: 'node_u', title: 'Wait' }]
      },
      cap.saved(),
      cap.persisters
    );
    expect(cap.saved().schema.flat.c1.definition.interactions?.node_u.elementId).toBeNull();
  });

  it('warns when an existing utility node carries a real (host) elementId, on patch', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      node_u: {
        id: 'node_u',
        title: 'Wait',
        type: 'utility',
        action: 'delayTime',
        params: { time: 2000 },
        preview: {},
        elementId: 'box-1',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_u',
        enabled: true
      }
    };
    const res = validate(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'box-1', nodeId: 'node_u', title: 'Renamed' }
        ]
      },
      space
    );
    expect(res.warnings.some(w => w.includes('delayTime') && w.includes('takes NO element'))).toBe(true);
  });

  it('warns on a literal string "undefined" elementId (stringified nullish, a builder artifact)', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      node_u: {
        id: 'node_u',
        title: 'Wait',
        type: 'utility',
        action: 'delayTime',
        params: { time: 2000 },
        preview: {},
        elementId: 'undefined',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_u',
        enabled: true
      }
    };
    const res = validate(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'box-1', nodeId: 'node_u', title: 'Renamed' }
        ]
      },
      space
    );
    expect(res.warnings.some(w => w.includes('literal string elementId') && w.includes('"undefined"'))).toBe(true);
  });

  it('warns when a global callback is used with nodeType "callback" (wrong node type)', () => {
    const res = validate(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'box-1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click' },
              { nodeType: 'callback', action: 'addNotification', title: 'Notify', params: { content: 'Hi' } }
            ]
          }
        ]
      },
      interactiveSpace()
    );
    expect(res.valid).toBe(true);
    expect(
      res.warnings.some(
        w => w.includes('addNotification') && w.includes('global callback') && w.includes('globalCallback')
      )
    ).toBe(true);
  });

  it('warns when a utility is used with nodeType "globalCallback" (wrong node type)', () => {
    const res = validate(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'box-1',
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

  // --- Dynamic per-space catalog: strict for default (custom:false) types, lenient for plugins (custom:true) ---

  const spaceWithCatalog = (catalog: ComponentCatalog): Space => ({ ...interactiveSpace(), catalog });

  const setStateFlow = (params: Record<string, unknown>): Operation => ({
    type: 'upsertInteractionFlow',
    pageRef: 'home',
    ref: 'box-1',
    nodes: [
      { nodeType: 'trigger', action: 'onClick', title: 'Click' },
      { nodeType: 'callback', action: 'setState', title: 'Set', params }
    ]
  });

  it('warns when the element setState is missing required params (category/key)', () => {
    const res = validate({ operations: [setStateFlow({ value: 'x' })] }, interactiveSpace());
    expect(res.valid).toBe(true);
    const missing = res.warnings.find(w => w.includes('setState') && w.includes('missing required'));
    expect(missing).toBeTruthy();
    expect(missing).toContain('"category"');
    expect(missing).toContain('"key"');
  });

  it('ERRORS on a setState attribute key not on a default (custom:false) target type; a real key passes', () => {
    const catalog: ComponentCatalog = {
      container: { custom: false, attributes: ['title', 'content'], styleSelectors: ['base'] }
    };
    const ok = validate(
      { operations: [setStateFlow({ category: 'attribute', key: 'content', value: 'x' })] },
      spaceWithCatalog(catalog)
    );
    expect(ok.valid).toBe(true);

    const bad = validate(
      { operations: [setStateFlow({ category: 'attribute', key: 'bogus', value: 'x' })] },
      spaceWithCatalog(catalog)
    );
    expect(bad.valid).toBe(false);
    expect(bad.errors.some(e => e.message.includes('container') && e.message.includes('bogus'))).toBe(true);
  });

  it('only WARNS on a bad setState key for a plugin (custom:true) target type', () => {
    const catalog: ComponentCatalog = {
      container: { custom: true, attributes: ['title'], styleSelectors: ['base'] }
    };
    const res = validate(
      { operations: [setStateFlow({ category: 'attribute', key: 'bogus', value: 'x' })] },
      spaceWithCatalog(catalog)
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('container') && w.includes('bogus'))).toBe(true);
  });

  it('validates category="state" keys against the type visibility + styleSelectors', () => {
    const catalog: ComponentCatalog = {
      container: { custom: false, attributes: ['title'], styleSelectors: ['base'] }
    };
    const ok = validate(
      { operations: [setStateFlow({ category: 'state', key: 'styleSelectors.base', value: 'true' })] },
      spaceWithCatalog(catalog)
    );
    expect(ok.valid).toBe(true);

    const bad = validate(
      { operations: [setStateFlow({ category: 'state', key: 'styleSelectors.nope', value: 'true' })] },
      spaceWithCatalog(catalog)
    );
    expect(bad.valid).toBe(false);
  });

  it('ERRORS on an unknown attribute of a default type, WARNS for a plugin type (upsertElement)', () => {
    const upsert: Operation = {
      type: 'upsertElement',
      pageRef: 'home',
      parentRef: 'page1',
      position: 'inside',
      element: { ref: 'w-1', type: 'container', props: { bogus: 1 } }
    };
    const strict = validate(
      { operations: [upsert] },
      spaceWithCatalog({ container: { custom: false, attributes: ['title'] } })
    );
    expect(strict.valid).toBe(false);
    expect(strict.errors.some(e => e.message.includes('container') && e.message.includes('bogus'))).toBe(true);

    const lenient = validate(
      { operations: [upsert] },
      spaceWithCatalog({ container: { custom: true, attributes: ['title'] } })
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

  // --- Value-type validation: a param of the WRONG type on a strict built-in catalog is a hard error, so a node
  // that is malformed by a wrong data type (not just an unknown key) is caught. ---

  const notifyFlow = (params: Record<string, unknown>): Operation => ({
    type: 'upsertInteractionFlow',
    pageRef: 'home',
    ref: 'box-1',
    nodes: [
      { nodeType: 'trigger', action: 'onClick', title: 'Click' },
      { nodeType: 'globalCallback', action: 'addNotification', title: 'Notify', params: { content: 'Hi', ...params } }
    ]
  });

  it('ERRORS on a non-numeric value for a number param, but ACCEPTS a numeric string (text input)', () => {
    const bad = validate({ operations: [notifyFlow({ autoDismissTimeout: 'soon' })] }, interactiveSpace());
    expect(bad.valid).toBe(false);
    expect(bad.errors.some(e => e.message.includes('autoDismissTimeout') && e.message.includes('number'))).toBe(true);

    // The builder's number fields are text inputs, so a numeric string ("5000") is legitimate and coerces at runtime.
    const ok = validate({ operations: [notifyFlow({ autoDismissTimeout: '5000' })] }, interactiveSpace());
    expect(ok.valid).toBe(true);
  });

  it('ERRORS on a boolean param given as a string', () => {
    const res = validate({ operations: [notifyFlow({ autoDismiss: 'true' })] }, interactiveSpace());
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('autoDismiss') && e.message.includes('boolean'))).toBe(true);
  });

  it('ERRORS on a select param value outside its options and lists the allowed values', () => {
    const res = validate({ operations: [notifyFlow({ appeareance: 'bogus' })] }, interactiveSpace());
    expect(res.valid).toBe(false);
    const err = res.errors.find(e => e.message.includes('appeareance'));
    expect(err?.validValues).toContain('success');
  });

  // `value` is a `scalar` param: its data type follows the target attribute (a boolean attribute stores a real
  // boolean, a number a real number), so none of these is a type error.
  it('accepts a scalar setState value of any primitive type (boolean / number / string)', () => {
    const flow = (value: unknown): Operation => ({
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'box-1',
      nodes: [
        { nodeType: 'trigger', action: 'onClick', title: 'Click' },
        { nodeType: 'callback', action: 'setState', title: 'Set', params: { category: 'attribute', key: 'x', value } }
      ]
    });
    expect(validate({ operations: [flow(true)] }, interactiveSpace()).valid).toBe(true);
    expect(validate({ operations: [flow(5)] }, interactiveSpace()).valid).toBe(true);
    expect(validate({ operations: [flow('Hola')] }, interactiveSpace()).valid).toBe(true);
  });

  // --- patchInteractionNode validates the MERGED node (stored params ∪ the patch), not only the keys touched: a
  // half-fixed node — one param corrected, another still malformed — is caught. ---

  it('re-validates the whole merged node on patch, catching a malformed param the patch did not touch', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      node_bad: {
        id: 'node_bad',
        title: 'Notify',
        type: 'globalCallback',
        action: 'addNotification',
        params: { content: 'Hi', autoDismissTimeout: 'soon' },
        preview: {},
        elementId: 'space',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_bad',
        enabled: true
      }
    };
    const res = validate(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'box-1', nodeId: 'node_bad', title: 'Renamed' }
        ]
      },
      space
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('autoDismissTimeout') && e.message.includes('number'))).toBe(true);
  });

  it('surfaces leftover unknown params (delay/time) on the merged node when patching one field', () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      node_x: {
        id: 'node_x',
        title: 'Set loading text',
        type: 'callback',
        action: 'setState',
        params: { key: 'content', value: 'probando...', category: 'attribute', delay: null, time: null },
        preview: {},
        elementId: 'box-1',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_x',
        enabled: true
      }
    };
    const res = validate(
      {
        operations: [
          { type: 'patchInteractionNode', pageRef: 'home', ref: 'box-1', nodeId: 'node_x', params: { value: 'nuevo' } }
        ]
      },
      space
    );
    expect(res.warnings.some(w => w.includes('setState') && w.includes('"delay"') && w.includes('"time"'))).toBe(true);
  });

  // The whole point: a patch whose OWN fields are correct must still be REJECTED (and NOT persisted) while the node
  // it lands on stays malformed — the agent has to fix the malformation too before the save goes through.
  it('blocks the save when a valid patch lands on an already-malformed node, and persists nothing', async () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      node_bad: {
        id: 'node_bad',
        title: 'Notify',
        type: 'globalCallback',
        action: 'addNotification',
        params: { content: 'Hi', autoDismissTimeout: 'soon' },
        preview: {},
        elementId: 'space',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_bad',
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
            ref: 'box-1',
            nodeId: 'node_bad',
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
    expect(cap.saved().schema.flat.c1.definition.interactions?.node_bad.params.content).toBe('Hi');
  });

  it('lets the save through once the same patch ALSO corrects the malformation', async () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      node_bad: {
        id: 'node_bad',
        title: 'Notify',
        type: 'globalCallback',
        action: 'addNotification',
        params: { content: 'Hi', autoDismissTimeout: 'soon' },
        preview: {},
        elementId: 'space',
        beforeNode: '',
        afterNode: '',
        flowId: 'node_bad',
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
            ref: 'box-1',
            nodeId: 'node_bad',
            params: { content: 'Nuevo contenido', autoDismissTimeout: 3000 }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const stored = cap.saved().schema.flat.c1.definition.interactions?.node_bad;
    expect(stored?.params.autoDismissTimeout).toBe(3000);
    expect(stored?.params.content).toBe('Nuevo contenido');
  });
});
