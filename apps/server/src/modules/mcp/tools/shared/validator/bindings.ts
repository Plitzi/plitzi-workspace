import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';

import { warnOnce } from './context';
import { getTransformer, suggestTransformer } from '../../../catalogs';
import { descendantIds, elementRefOf, findElementByRef } from '../../../helpers';

import type { ValidationCtx } from './context';
import type { Space } from '../../../helpers';
import type { BindingTransformer } from '@plitzi/sdk-shared';

// Binding-specific validation: the two mistakes the agent makes most on data bindings.
// 1. SCOPE — binding an element to a `<type>_<idRef>` source whose provider is NOT one of its ancestors. The
//    provider exposes its source to its DESCENDANTS only (it wraps its subtree in the source scope), so a
//    cross-subtree binding NEVER resolves at runtime — the source simply is not in scope. This is a genuine
//    malformation, so it is an ERROR (it blocks the save). Fired only when both elements resolve (a provider
//    created later in the same batch is not yet in the tree, so it is skipped there — the post-apply audit catches
//    it against the resulting tree instead).
// 2. TRANSFORMERS — an unknown transformer action (silently skipped by the runtime, e.g. `template` for
//    `twigTemplate`), unknown params, a missing required param, or a select value outside its options.

// The provider element a `<type>_<idRef>[.field...]` source resolves to, or undefined when the head is a module
// source (no `<type>_` head) or the provider is not in the current space. An element source name has exactly one
// `_` (a type is camelCase with no underscore; an idRef is [A-Za-z0-9-] with no underscore), so the split is safe.
const providerOfSource = (space: Space, source: string): { ref: string; id: string } | undefined => {
  const head = source.split('.')[0];
  const sep = head.indexOf('_');
  if (sep < 0) {
    return undefined;
  }

  const idRef = head.slice(sep + 1);
  const el = findElementByRef(space.schema, idRef);
  // Confirm the head really is this element's source name (guards a type/idRef that happens to contain a '_').
  if (!el || getSourceName(el.definition.type, el) !== head) {
    return undefined;
  }

  return { ref: elementRefOf(el), id: el.id };
};

// When the bound element's type declares its allowed binding targets (a plugin manifest's `bindingsAllowed`), warn
// if the `to` target is not among them. Lenient (warning): only plugin types carry this list, and a manifest is a
// best-effort snapshot. Categories other than attributes/initialState (e.g. style) carry no such list.
export const checkBindingTarget = (
  ref: string,
  category: string | undefined,
  to: string,
  path: string,
  ctx: ValidationCtx
): void => {
  if (category !== 'attributes' && category !== 'initialState') {
    return;
  }

  const type = ctx.elementType(ref);
  const targets = type ? ctx.typeMeta.get(type)?.bindingTargets?.[category] : undefined;
  if (!targets || targets.size === 0 || targets.has(to)) {
    return;
  }

  warnOnce(
    ctx,
    `Binding target "${to}" at ${path} is not among the "${category}" targets the type "${type}" declares ` +
      `(${[...targets].sort().join(', ')}). Verify against plitzi://data-sources; it may still be valid.`
  );
};

export const checkBindingSourceScope = (
  space: Space,
  ctx: ValidationCtx,
  elementRef: string,
  source: string,
  path: string
): void => {
  const provider = providerOfSource(space, source);
  if (!provider) {
    return;
  }

  const bound = findElementByRef(space.schema, elementRef);
  if (!bound) {
    return;
  }

  if (bound.id !== provider.id && descendantIds(space.schema, provider.id).includes(bound.id)) {
    return;
  }

  // A genuine malformation: schema-valid, but the source is not in scope for this element, so the binding is broken
  // and produces nothing at runtime. Error (blocks the save) — the agent must move the element or pick a source in
  // scope. (Module sources like state/space are global and never reach here — providerOfSource skips them.)
  ctx.errors.push({
    path,
    message: `Binding source "${source}" is provided by element "${provider.ref}", but "${elementRef}" is not inside its subtree`,
    hint:
      'An element source is scoped to its DESCENDANTS only, so this binding resolves to nothing at runtime (the ' +
      `source is not available outside "${provider.ref}"). Move "${elementRef}" under "${provider.ref}", or bind to ` +
      'a source that is in scope (e.g. a global module source like state/space/navigation).'
  });
};

// A transformer is resolved by its `action` alone against a CLOSED built-in set (no plugin transformer mechanism),
// so a malformed transformer is DEFINITELY broken — an unknown action, a missing required param or a bad select
// value all make the binding silently misbehave. These are ERRORS (they block a save until fixed), unlike the
// lenient source/target checks. Unknown extra params stay a warning (the runtime just drops them).
export const checkBindingTransformers = (
  transformers: BindingTransformer[] | undefined,
  path: string,
  ctx: ValidationCtx
): void => {
  transformers?.forEach((transformer, i) => {
    const base = `${path}[${i}]`;
    const spec = getTransformer(transformer.action);
    if (!spec) {
      const suggestion = suggestTransformer(transformer.action);
      ctx.errors.push({
        path: `${base}.action`,
        message: `Unknown transformer action "${transformer.action}"`,
        hint:
          'The runtime skips an unknown transformer and passes the value through unchanged.' +
          `${suggestion ? ` Did you mean "${suggestion}"?` : ''} See the transformers list in plitzi://data-sources.`
      });

      return;
    }

    const params = transformer.params;
    const unknown = Object.keys(params).filter(key => !(key in spec.params));
    if (spec.strictParams && unknown.length > 0) {
      warnOnce(
        ctx,
        `Transformer "${transformer.action}" at ${base} got unknown param(s) ${unknown.map(k => `"${k}"`).join(', ')} ` +
          `— the runtime ignores them. Valid params: ${Object.keys(spec.params).join(', ') || '(none)'}.`
      );
    }

    for (const [key, param] of Object.entries(spec.params)) {
      if (param.required && !(key in params)) {
        ctx.errors.push({
          path: `${base}.params.${key}`,
          message: `Transformer "${transformer.action}" is missing required param "${key}"`,
          hint: param.description
        });
      }

      if (param.type === 'select' && param.options && key in params && !param.options.includes(params[key])) {
        ctx.errors.push({
          path: `${base}.params.${key}`,
          message: `Transformer "${transformer.action}" param "${key}" is "${params[key]}", not one of its options`,
          hint: `Use one of: ${param.options.join(', ')}.`,
          validValues: param.options
        });
      }
    }
  });
};
