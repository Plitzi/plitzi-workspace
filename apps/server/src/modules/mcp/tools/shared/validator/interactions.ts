import { checkObservedName, warnOnce } from './context';
import {
  getElementCallback,
  getGlobalCallback,
  getUtility,
  hiddenParams,
  missingRequiredParams,
  reconcileParams
} from '../../../catalogs';

import type { ValidationCtx } from './context';
import type { ParamSpec } from '../../../catalogs';
import type { InteractionNodeInput } from '../../operations/schema/shared';

// Interaction-node validation. The MCP knows three built-in vocabularies — globalCallbacks (source modules),
// element callbacks (registered by every element) and utilities — each with its OWN param schema. The single most
// common mistake is picking the WRONG node type for an action (so the runtime resolves it against nothing and the
// step silently no-ops), or leaking one setState's params onto the other. This module tells them apart by node
// type and validates each node against the matching schema. Most checks WARN (an unlisted action may be a valid
// plugin/element-specific callback); a setState `key` that is not a real attribute of a DEFAULT (sdk-elements)
// type is a hard ERROR, since we own the full attribute set of those types.

// setState exists as BOTH a globalCallback (source `state`, params key/type/value → runtime.state.*) and an element
// callback (params category/key/value/revertOnFinish → the element's own attribute/state). It is disambiguated by
// node type, so it is never cross-warned as "wrong type".

const checkParams = (
  label: string,
  action: string,
  params: Record<string, unknown>,
  spec: ParamSpec,
  base: string,
  ctx: ValidationCtx
): void => {
  const unknown = Object.keys(params).filter(key => !(key in spec));
  if (unknown.length > 0) {
    warnOnce(
      ctx,
      `${label} "${action}" at ${base} got unknown param(s) ${unknown.map(k => `"${k}"`).join(', ')} — these are ` +
        `dropped on apply. Valid params: ${Object.keys(spec).join(', ')}.`
    );
  }

  const effective = reconcileParams(params, spec, true);
  const missing = missingRequiredParams(params, effective, spec);
  if (missing.length > 0) {
    warnOnce(
      ctx,
      `${label} "${action}" at ${base} is missing required param(s) ${missing.map(k => `"${k}"`).join(', ')} — the ` +
        'step is malformed without them (see plitzi://interactions for what each does).'
    );
  }

  const hidden = hiddenParams(params, effective, spec);
  if (hidden.length > 0) {
    warnOnce(
      ctx,
      `${label} "${action}" at ${base}: param(s) ${hidden.map(k => `"${k}"`).join(', ')} are ignored under the ` +
        'current params (they only apply when a companion param is set — see plitzi://interactions). Set the ' +
        'companion param or drop them.'
    );
  }
};

const checkGlobalCallback = (node: InteractionNodeInput, base: string, ctx: ValidationCtx): void => {
  const builtin = getGlobalCallback(node.action);
  if (!builtin) {
    if (getUtility(node.action)) {
      warnOnce(ctx, `"${node.action}" at ${base} is a utility, not a global callback — use nodeType "utility".`);
    } else if (getElementCallback(node.action)) {
      warnOnce(
        ctx,
        `"${node.action}" at ${base} is an element callback, not a global callback — use nodeType "callback" and ` +
          'set elementId to the element it acts on.'
      );
    }

    return;
  }

  // A built-in globalCallback is registered on its source module — the MCP pins elementId to that source. Warn (not
  // fail) when the agent points it at the host element instead, the common mistake.
  if (node.elementId !== undefined && node.elementId !== builtin.source) {
    warnOnce(
      ctx,
      `Global callback "${node.action}" at ${base} is registered on "${builtin.source}", not on ` +
        `"${node.elementId}". Omit elementId (the MCP sets "${builtin.source}") or set it to "${builtin.source}".`
    );
  }

  if (node.params && builtin.strictParams) {
    checkParams('Global callback', node.action, node.params, builtin.params, base, ctx);
  }
};

// The element `setState` sets an attribute or state key of the TARGET element. We can validate the key against that
// element's type: strict (ERROR) for a default (custom:false) type — we own its full attribute/selector set — and
// lenient (WARNING) for a plugin/unknown type. `category="attribute"` → key ∈ the type's attributes;
// `category="state"` → key is `visibility` or `styleSelectors.<selector>`.
const checkSetStateKey = (node: InteractionNodeInput, base: string, ctx: ValidationCtx, hostRef: string): void => {
  const key = node.params?.key;
  if (typeof key !== 'string' || key === '') {
    return;
  }

  const targetRef = typeof node.elementId === 'string' && node.elementId !== '' ? node.elementId : hostRef;
  const type = ctx.elementType(targetRef);
  const meta = type ? ctx.typeMeta.get(type) : undefined;
  if (!meta) {
    return;
  }

  const state = node.params?.category === 'state';
  const validKeys = state
    ? new Set<string>(['visibility', ...[...meta.styleSelectors].map(selector => `styleSelectors.${selector}`)])
    : meta.attributes;
  // An attribute set we do not know (empty) is no basis to flag.
  if (validKeys.size === 0 || validKeys.has(key)) {
    return;
  }

  const kind = state ? 'state' : 'attribute';
  const valid = [...validKeys].sort();
  const detail = `Element setState at ${base} sets ${kind} "${key}" on type "${type}", which has no such ${kind} key`;
  if (!meta.custom) {
    ctx.errors.push({ path: base, message: detail, hint: `Use one of: ${valid.join(', ')}`, validValues: valid });
  } else {
    warnOnce(ctx, `${detail} (${valid.join(', ')}). It may still be valid — verify against plitzi://types.`);
  }
};

const checkElementCallback = (node: InteractionNodeInput, base: string, ctx: ValidationCtx, hostRef: string): void => {
  const builtin = getElementCallback(node.action);
  if (!builtin) {
    if (getUtility(node.action)) {
      warnOnce(ctx, `"${node.action}" at ${base} is a utility, not an element callback — use nodeType "utility".`);
    } else {
      const global = getGlobalCallback(node.action);
      if (global) {
        warnOnce(
          ctx,
          `"${node.action}" at ${base} is a global callback (source "${global.source}"), not an element callback — ` +
            'use nodeType "globalCallback" and omit elementId.'
        );
      }
    }

    return;
  }

  if (node.params && builtin.strictParams) {
    checkParams('Element callback', node.action, node.params, builtin.params, base, ctx);
  }

  if (node.action === 'setState') {
    checkSetStateKey(node, base, ctx, hostRef);
  }
};

const checkUtility = (node: InteractionNodeInput, base: string, ctx: ValidationCtx): void => {
  const utility = getUtility(node.action);
  if (!utility) {
    if (getGlobalCallback(node.action)) {
      warnOnce(ctx, `"${node.action}" at ${base} is a global callback, not a utility — use nodeType "globalCallback".`);
    } else if (getElementCallback(node.action)) {
      warnOnce(ctx, `"${node.action}" at ${base} is an element callback, not a utility — use nodeType "callback".`);
    }

    return;
  }

  if (node.params && utility.strictParams) {
    checkParams('Utility', node.action, node.params, utility.params, base, ctx);
  }
};

export const checkInteractionNode = (
  node: InteractionNodeInput,
  base: string,
  ctx: ValidationCtx,
  hostRef: string
): void => {
  checkObservedName(
    node.action,
    ctx.observedActions,
    'Interaction action',
    'plitzi://interactions',
    `${base}.action`,
    ctx
  );

  switch (node.nodeType) {
    case 'globalCallback':
      checkGlobalCallback(node, base, ctx);
      break;
    case 'callback':
      checkElementCallback(node, base, ctx, hostRef);
      break;
    case 'utility':
      checkUtility(node, base, ctx);
      break;
    default:
      break;
  }
};
