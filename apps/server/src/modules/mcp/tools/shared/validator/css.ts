import { checkStyleVarRefs, checkVarRefs } from './context';
import { expandShorthand, isCssProperty, suggestCssProperty } from '../../../resources';

import type { ValidationCtx } from './context';
import type { DefinitionSlotPatch } from '../../operations';

// Accepts a patch map too: a null value marks a property for removal (patchDefinition), which needs no key/value
// validation, so it is dropped before checking.
export const checkCss = (
  css: Record<string, string | number | null> | undefined,
  path: string,
  ctx: ValidationCtx
): void => {
  if (!css) {
    return;
  }

  const declared: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(css)) {
    if (value !== null) {
      declared[key] = value;
    }
  }

  // Expand shorthands first (border, border-radius, padding…) so they validate as their longhand keys — matching
  // what persistence stores (RFC 0004 I4).
  for (const [key, value] of Object.entries(expandShorthand(declared))) {
    if (!isCssProperty(key)) {
      const suggestion = suggestCssProperty(key);
      ctx.errors.push({
        path: `${path}.${key}`,
        message: `Unknown CSS property "${key}"`,
        hint: suggestion
          ? `Use the kebab-case key "${suggestion}"`
          : 'Read plitzi://css-properties for the valid property keys'
      });
    }

    if (typeof value === 'string') {
      checkStyleVarRefs(value, `${path}.${key}`, ctx);
      checkVarRefs(value, `${path}.${key}`, ctx);
    }
  }
};

// Accepts both the full DefinitionSlotInput (upsert) and DefinitionSlotPatch (patch, with null removals) — the
// latter is the wider type, and checkCss tolerates the nulls.
export const checkSlotCss = (slot: DefinitionSlotPatch, path: string, ctx: ValidationCtx): void => {
  checkCss(slot.desktop, `${path}.desktop`, ctx);
  checkCss(slot.tablet, `${path}.tablet`, ctx);
  checkCss(slot.mobile, `${path}.mobile`, ctx);
  for (const [state, dm] of Object.entries(slot.states ?? {})) {
    checkCss(dm.desktop, `${path}.states.${state}.desktop`, ctx);
    checkCss(dm.tablet, `${path}.states.${state}.tablet`, ctx);
    checkCss(dm.mobile, `${path}.states.${state}.mobile`, ctx);
  }

  for (const [name, dm] of Object.entries(slot.variants ?? {})) {
    checkCss(dm.desktop, `${path}.variants.${name}.desktop`, ctx);
    checkCss(dm.tablet, `${path}.variants.${name}.tablet`, ctx);
    checkCss(dm.mobile, `${path}.variants.${name}.mobile`, ctx);
  }
};
