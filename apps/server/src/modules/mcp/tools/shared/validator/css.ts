import { checkStyleVarRefs, checkVarRefs, warnOnce } from './context';
import { compoundLonghands, expandShorthand, isCssProperty, suggestCssProperty } from '../../../resources';

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
    const longhands = compoundLonghands(key);
    if (longhands) {
      // A multi-value compound shorthand the style engine does not atomize. Plitzi styling is atomic, so steer to the
      // longhands: a hard error when the key is not even valid (flex/background/font/…), a warning when it is
      // accepted-but-compound (transition/overflow/…) so a breakpoint/state can override each property on its own.
      if (!isCssProperty(key)) {
        ctx.errors.push({
          path: `${path}.${key}`,
          message: `Compound CSS shorthand "${key}" is not supported — write its atomic longhand properties`,
          hint: `Use: ${longhands.join(', ')}. (Note: flex layout is display + flex-direction + flex-grow/shrink/basis, not "flex".)`,
          validValues: longhands
        });
      } else {
        warnOnce(
          ctx,
          `CSS shorthand "${key}" at ${path}.${key} is accepted but stored as one compound value. Plitzi styling is ` +
            `atomic — prefer the longhands (${longhands.join(', ')}) so a breakpoint/state/variant can override each ` +
            'property independently.'
        );
      }
    } else if (!isCssProperty(key)) {
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
