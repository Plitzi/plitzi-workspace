import { warnOnce } from './context';

import type { ValidationCtx } from './context';

// Binding validation the MCP owns: a target a plugin's manifest does not declare. What a binding MEANS — its
// transformers, whether its source is in scope — is read from the resulting draft by `lintSpace` (see lintDraft), the
// linter every door into a space shares.

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
