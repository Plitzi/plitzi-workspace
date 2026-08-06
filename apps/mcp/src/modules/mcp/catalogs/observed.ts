import { BUILTIN_GLOBAL_CALLBACKS } from './builtinCallbacks';
import { BUILTIN_ELEMENT_CALLBACKS } from './builtinElementCallbacks';
import { transformerCatalog } from './builtinTransformers';
import { BUILTIN_UTILITIES } from './builtinUtilities';

import type { TransformerInfo } from './builtinTransformers';
import type { BuiltinParam } from './paramSpec';
import type { AIInteractionNodeType } from '../types';
import type { Schema } from '@plitzi/sdk-shared';

// Interaction actions and data-source paths are observed from what already exists in the space — the SSR runtime
// has no plugin manifest of the available callbacks/sources (same constraint as observed element types). These
// catalogs are ground truth for discovery, and feed lenient validator warnings (an unseen name may still be
// valid, so it is a warning, never a hard error).

export interface BuiltinParamInfo {
  name: string;
  type: string;
  description: string;
  default?: string | number | boolean;
  options?: string[];
  // True when the param is only shown/relevant under a condition (mirrors the source param's `when`).
  conditional?: boolean;
}

export interface BuiltinGlobalCallbackInfo {
  action: string;
  // The module id this global callback is registered on — the value a node's `elementId` MUST carry (never the host
  // element). The MCP sets it for you when you omit it.
  source: string;
  title: string;
  // When true, ONLY the listed params are valid — any other key is rejected. When false the callback also accepts
  // arbitrary per-collection field keys on top of the listed params.
  strictParams: boolean;
  // The full set of valid params for this callback: name, type, meaning, default and (for selects) allowed options.
  // Use exactly these keys — do not invent params like `title`/`message`/`type`.
  params: BuiltinParamInfo[];
}

export interface BuiltinActionInfo {
  action: string;
  title: string;
  strictParams: boolean;
  params: BuiltinParamInfo[];
}

export interface InteractionCatalog {
  note: string;
  actions: Record<string, string[]>;
  globalCallbacksNote: string;
  globalCallbacks: BuiltinGlobalCallbackInfo[];
  elementCallbacksNote: string;
  elementCallbacks: BuiltinActionInfo[];
  utilitiesNote: string;
  utilities: BuiltinActionInfo[];
  flowCount: number;
}

export interface DataSourceCatalog {
  note: string;
  scopeNote: string;
  sources: string[];
  targets: Record<string, string[]>;
  transformersNote: string;
  transformers: TransformerInfo[];
}

const INTERACTION_NOTE =
  'Interaction actions observed on this space, grouped by node type. A flow is a trigger followed by ordered ' +
  'callbacks/utilities; write one with upsertInteractionFlow. Names not listed may still be valid plugin actions.';

const GLOBAL_CALLBACKS_NOTE =
  'Built-in global callbacks always available in every space. A globalCallback is registered on its SOURCE MODULE, ' +
  'so its node `elementId` is the listed `source` (e.g. "space" for addNotification) — NOT the element that hosts ' +
  'the flow. Omit `elementId` and the MCP sets the right source and fills the param defaults for you. Use ONLY the ' +
  'params listed under each callback (with the exact spelling shown) — for addNotification the visible text goes in ' +
  '`content`; there is no title/message/type param. When strictParams is true, any other key is rejected.';

const ELEMENT_CALLBACKS_NOTE =
  'Built-in `callback`-type actions every element registers on ITSELF. Unlike a globalCallback, an element callback ' +
  'runs against a real element, so its node `elementId` is that element (the flow host by default, or another ' +
  'element to act on) and its nodeType is "callback". `setState` here changes the element\'s own attribute/state ' +
  '(params category/key/value/revertOnFinish) — NOT the global state setState (which is a globalCallback on source ' +
  '"state" with params key/type/value). Set revertOnFinish:true for a TEMPORARY change (e.g. a "loading…" label): it ' +
  'is undone automatically when the flow finishes, so you do NOT add manual restore steps. A specific element type ' +
  'may register more callbacks beyond these defaults.';

const UTILITIES_NOTE =
  'Built-in `utility`-type actions (no element/source module). Use nodeType "utility". Use the EXACT param names — ' +
  'e.g. delayTime waits `time` milliseconds (not `delay`).';

const toParamInfo = (params: Record<string, BuiltinParam>): BuiltinParamInfo[] =>
  Object.entries(params).map(([name, spec]) => ({
    name,
    type: spec.type,
    description: spec.description,
    ...(spec.default !== undefined ? { default: spec.default } : {}),
    ...(spec.options ? { options: spec.options } : {}),
    ...(spec.when ? { conditional: true } : {})
  }));

const builtinGlobalCallbacks = (): BuiltinGlobalCallbackInfo[] =>
  Object.entries(BUILTIN_GLOBAL_CALLBACKS).map(([action, { source, title, strictParams, params }]) => ({
    action,
    source,
    title,
    strictParams,
    params: toParamInfo(params)
  }));

const builtinElementCallbacks = (): BuiltinActionInfo[] =>
  Object.entries(BUILTIN_ELEMENT_CALLBACKS).map(([action, { title, strictParams, params }]) => ({
    action,
    title,
    strictParams,
    params: toParamInfo(params)
  }));

const builtinUtilities = (): BuiltinActionInfo[] =>
  Object.entries(BUILTIN_UTILITIES).map(([action, { title, strictParams, params }]) => ({
    action,
    title,
    strictParams,
    params: toParamInfo(params)
  }));

const DATA_SOURCE_NOTE =
  'Data-source paths and binding targets observed on this space. Bind a source to an element field with ' +
  'upsertBinding (category attributes|style|initialState). Paths not listed may still be valid. A binding may ' +
  'post-process its value through `transformers` (see below) and be gated by a `when` QueryBuilder guard.';

const DATA_SOURCE_SCOPE_NOTE =
  'SCOPE: an element source named `<type>_<idRef>` (e.g. `apiContainer_products`, `list_food-list`) is provided by ' +
  'that element to its DESCENDANTS ONLY — the provider wraps its subtree in the source’s scope, so only elements ' +
  'INSIDE the provider can bind to it. Binding a sibling or unrelated element to it is schema-valid but broken at ' +
  'runtime (the source is not in scope), and validate/apply REJECT it as an error. To consume `apiContainer_x.data`, ' +
  'the bound element must live under that apiContainer. Module sources (no `<type>_<idRef>` head — e.g. ' +
  'state/space/navigation/auth/collection) are global and bindable anywhere.';

const TRANSFORMERS_NOTE =
  'Built-in transformers that post-process a binding value before it reaches the field: `source → t₁ → t₂ → field`. ' +
  'Set them on a binding as `transformers: [{ action, params }]` (params are strings). The runtime resolves each by ' +
  'its `action` alone, so an UNKNOWN action is silently skipped (the value passes through unchanged) — use the exact ' +
  'action names below. Common formatting is `twigTemplate` (the value is the {{source}} token, not {{value}}).';

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
    elementCallbacksNote: ELEMENT_CALLBACKS_NOTE,
    elementCallbacks: builtinElementCallbacks(),
    utilitiesNote: UTILITIES_NOTE,
    utilities: builtinUtilities(),
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

  return {
    note: DATA_SOURCE_NOTE,
    scopeNote: DATA_SOURCE_SCOPE_NOTE,
    sources: [...sources].sort(),
    targets: groupedTargets,
    transformersNote: TRANSFORMERS_NOTE,
    transformers: transformerCatalog()
  };
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
