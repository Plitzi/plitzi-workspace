import { BUILTIN_GLOBAL_CALLBACKS } from '../../../helpers';

import type { AIInteractionNodeType } from '../../../types';
import type { Schema } from '@plitzi/sdk-shared';

// Interaction actions and data-source paths are observed from what already exists in the space — the SSR runtime
// has no plugin manifest of the available callbacks/sources (same constraint as observed element types). These
// catalogs are ground truth for discovery, and feed lenient validator warnings (an unseen name may still be
// valid, so it is a warning, never a hard error).

export interface BuiltinGlobalCallbackInfo {
  action: string;
  // The module id this global callback is registered on — the value a node's `elementId` MUST carry (never the host
  // element). The MCP sets it for you when you omit it.
  source: string;
  title: string;
  // Param default values the MCP fills for you when you omit them.
  defaults: Record<string, string | number | boolean>;
}

export interface InteractionCatalog {
  note: string;
  actions: Record<string, string[]>;
  globalCallbacksNote: string;
  globalCallbacks: BuiltinGlobalCallbackInfo[];
  flowCount: number;
}

export interface DataSourceCatalog {
  note: string;
  sources: string[];
  targets: Record<string, string[]>;
}

const INTERACTION_NOTE =
  'Interaction actions observed on this space, grouped by node type. A flow is a trigger followed by ordered ' +
  'callbacks/utilities; write one with upsertInteractionFlow. Names not listed may still be valid plugin actions.';

const GLOBAL_CALLBACKS_NOTE =
  'Built-in global callbacks always available in every space. A globalCallback is registered on its SOURCE MODULE, ' +
  'so its node `elementId` is the listed `source` (e.g. "space" for addNotification) — NOT the element that hosts ' +
  'the flow. Omit `elementId` and the MCP sets the right source and fills the listed param defaults for you.';

const builtinGlobalCallbacks = (): BuiltinGlobalCallbackInfo[] =>
  Object.entries(BUILTIN_GLOBAL_CALLBACKS).map(([action, { source, title, defaults }]) => ({
    action,
    source,
    title,
    defaults: Object.fromEntries(Object.entries(defaults).map(([key, def]) => [key, def.value]))
  }));

const DATA_SOURCE_NOTE =
  'Data-source paths and binding targets observed on this space. Bind a source to an element field with ' +
  'upsertBinding (category attributes|style|initialState). Paths not listed may still be valid.';

export const buildInteractionCatalog = (schema: Schema): InteractionCatalog => {
  const actions: Record<string, Set<string>> = {};
  const flows = new Set<string>();
  for (const el of Object.values(schema.flat)) {
    for (const node of Object.values(el.definition.interactions ?? {})) {
      (actions[node.type] ??= new Set()).add(node.action);
      flows.add(node.flowId || node.id);
    }
  }

  const grouped: Record<string, string[]> = {};
  for (const [nodeType, set] of Object.entries(actions)) {
    grouped[nodeType] = [...set].sort();
  }

  return {
    note: INTERACTION_NOTE,
    actions: grouped,
    globalCallbacksNote: GLOBAL_CALLBACKS_NOTE,
    globalCallbacks: builtinGlobalCallbacks(),
    flowCount: flows.size
  };
};

export const buildDataSourceCatalog = (schema: Schema): DataSourceCatalog => {
  const sources = new Set<string>();
  const targets: Record<string, Set<string>> = {};
  for (const el of Object.values(schema.flat)) {
    for (const [category, list] of Object.entries(el.definition.bindings ?? {})) {
      for (const binding of list) {
        sources.add(binding.source);
        (targets[category] ??= new Set()).add(binding.to);
      }
    }
  }

  const groupedTargets: Record<string, string[]> = {};
  for (const [category, set] of Object.entries(targets)) {
    groupedTargets[category] = [...set].sort();
  }

  return { note: DATA_SOURCE_NOTE, sources: [...sources].sort(), targets: groupedTargets };
};

export const observedInteractionActions = (schema: Schema): Set<string> => {
  const actions = new Set<string>();
  for (const el of Object.values(schema.flat)) {
    for (const node of Object.values(el.definition.interactions ?? {})) {
      actions.add(node.action);
    }
  }

  return actions;
};

export const observedDataSources = (schema: Schema): Set<string> => {
  const sources = new Set<string>();
  for (const el of Object.values(schema.flat)) {
    for (const list of Object.values(el.definition.bindings ?? {})) {
      for (const binding of list) {
        sources.add(binding.source);
      }
    }
  }

  return sources;
};

// Kept so a future grouped read/validation can address the node types without re-deriving the union.
export const INTERACTION_NODE_TYPES: AIInteractionNodeType[] = ['trigger', 'globalCallback', 'callback', 'utility'];
