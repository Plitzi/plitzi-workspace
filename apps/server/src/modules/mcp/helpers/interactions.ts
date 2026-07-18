import { generateObjectId } from './space';
import { applyBuiltinCallback, applyElementCallback, applyUtility } from '../catalogs';

import type { AIBinding, AIBindings, AIInteractionFlow, AIInteractionNode, AIInteractionNodeType } from '../types';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { ElementBinding, ElementDefinition, ElementInteraction } from '@plitzi/sdk-shared';

/** The node shape agents supply on write: same as AIInteractionNode but `id` is optional (generated when
 *  omitted). Kept structural so the tool-layer zod type assigns to it without importing the tool layer here. */
export interface FlowNodeInput {
  id?: string;
  title: string;
  nodeType: AIInteractionNodeType;
  action: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
  when?: RuleGroup;
  elementId?: string;
  preview?: Record<string, unknown>;
}

// Bridge between the stored, wire-level shapes (a doubly-linked node map for interactions, category-keyed binding
// arrays) and the ordered, agent-friendly projections the MCP reads and writes. Interactions are stored as a map
// of nodes linked by beforeNode/afterNode with flowId === the trigger id; agents never wire those links by hand —
// they pass an ordered list of nodes and this module recomputes the linkage.

const BINDING_CATEGORIES: Array<keyof AIBindings> = ['attributes', 'style', 'initialState'];

const isNonEmptyObject = (value: Record<string, unknown> | undefined): boolean =>
  value !== undefined && Object.keys(value).length > 0;

// --- Interactions (read): map → ordered flows ---

const nodeToAI = (node: ElementInteraction): AIInteractionNode => {
  const ai: AIInteractionNode = { id: node.id, title: node.title, nodeType: node.type, action: node.action };
  if (isNonEmptyObject(node.params)) {
    ai.params = node.params;
  }

  if (!node.enabled) {
    ai.enabled = false;
  }

  if (node.when !== undefined) {
    ai.when = node.when;
  }

  if (node.elementId && node.elementId !== node.id) {
    ai.elementId = node.elementId;
  }

  if (isNonEmptyObject(node.preview)) {
    ai.preview = node.preview;
  }

  return ai;
};

// Walk one flow from its trigger, following afterNode, so the projection reflects execution order. Cycles and
// dangling links are guarded (a broken chain simply stops), and any node never reached from a head is appended so
// nothing is silently dropped.
const orderFlow = (nodes: ElementInteraction[]): ElementInteraction[] => {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const head = nodes.find(n => !n.beforeNode || !byId.has(n.beforeNode)) ?? nodes[0];
  const ordered: ElementInteraction[] = [];
  const seen = new Set<string>();
  let current: ElementInteraction | undefined = head;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    current = current.afterNode ? byId.get(current.afterNode) : undefined;
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
};

export const flowsFromInteractions = (
  interactions: Record<string, ElementInteraction> | undefined
): AIInteractionFlow[] => {
  if (!interactions || Object.keys(interactions).length === 0) {
    return [];
  }

  const byFlow = new Map<string, ElementInteraction[]>();
  for (const node of Object.values(interactions)) {
    const key = node.flowId || node.id;
    const list = byFlow.get(key);
    if (list) {
      list.push(node);
    } else {
      byFlow.set(key, [node]);
    }
  }

  const flows: AIInteractionFlow[] = [];
  for (const [flowId, nodes] of byFlow) {
    flows.push({ flowId, nodes: orderFlow(nodes).map(nodeToAI) });
  }

  return flows;
};

// --- Interactions (write): ordered flow → linked node map ---

export const newNodeId = (): string => `node_${generateObjectId()}`;

/** Materialize an ordered list of nodes into the stored linked-node map for ONE flow: assign ids where missing,
 *  set flowId to the trigger id, and recompute beforeNode/afterNode from the order. `ownerId` is the default
 *  source element for callbacks that name none. */
export const materializeFlow = (
  nodes: FlowNodeInput[],
  ownerId: string
): { flowId: string; record: Record<string, ElementInteraction> } => {
  const ids = nodes.map(node => node.id || newNodeId());
  const flowId = ids[0];
  const record: Record<string, ElementInteraction> = {};

  nodes.forEach((node, i) => {
    let params = node.params ?? {};
    // Reconcile params to the catalog that matches the node type, so the stored node round-trips like the builder's:
    // unknown keys dropped, builder defaults filled. Each node type resolves its callback differently:
    //  - globalCallback — registered on a SOURCE MODULE, so elementId is that source (e.g. `space`), never the owner.
    //  - callback — a callback ON an element (the owner by default, or a target); a built-in one (setState) is
    //    reconciled, an element-type-specific/plugin one is left as-is (its schema is not knowable here).
    //  - utility — resolved as `utility[action]`, so elementId is irrelevant; only its params are reconciled.
    let elementId = node.elementId ?? ownerId;
    if (node.nodeType === 'globalCallback') {
      const builtin = applyBuiltinCallback(node.action, params);
      if (builtin.source) {
        elementId = builtin.source;
        params = builtin.params;
      }
    } else if (node.nodeType === 'callback') {
      params = applyElementCallback(node.action, params).params;
    } else if (node.nodeType === 'utility') {
      params = applyUtility(node.action, params).params;
    }

    const interaction: ElementInteraction = {
      id: ids[i],
      title: node.title,
      type: node.nodeType,
      action: node.action,
      params,
      preview: node.preview ?? {},
      elementId,
      beforeNode: i > 0 ? ids[i - 1] : '',
      afterNode: i < ids.length - 1 ? ids[i + 1] : '',
      flowId,
      enabled: node.enabled ?? true
    };
    if (node.when !== undefined) {
      interaction.when = node.when;
    }

    record[ids[i]] = interaction;
  });

  return { flowId, record };
};

// --- Data bindings ---

export const bindingToAI = (binding: ElementBinding): AIBinding => {
  const ai: AIBinding = { id: binding.id, to: binding.to, source: binding.source };
  if (binding.transformers && binding.transformers.length > 0) {
    ai.transformers = binding.transformers;
  }

  if (binding.when !== undefined) {
    ai.when = binding.when;
  }

  if (binding.enabled === false) {
    ai.enabled = false;
  }

  return ai;
};

export const bindingsToAI = (bindings: ElementDefinition['bindings'] | undefined): AIBindings | undefined => {
  if (!bindings) {
    return undefined;
  }

  const result: AIBindings = {};
  for (const category of BINDING_CATEGORIES) {
    const list = bindings[category];
    if (list && list.length > 0) {
      result[category] = list.map(bindingToAI);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

export { BINDING_CATEGORIES };
