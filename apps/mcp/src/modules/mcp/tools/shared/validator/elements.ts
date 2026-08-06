import { RAW_CODE_TYPES, checkVarRefs, warnOnce } from './context';
import { checkIdRef } from './refs';
import { definitionVariantNames } from '../../operations/style/translator';

import type { ValidationCtx } from './context';
import type { ElementInput } from '../../operations';
import type { InitialStateInput } from '../../operations/schema/shared';

// Flag a prop that is not one the type declares. Strict-vs-lenient by ownership: for a DEFAULT (sdk-elements) type
// we own the full attribute set (catalog `custom:false`), so an unknown prop is an ERROR; for a PLUGIN type
// (`custom:true`) or a type only known from observed instances it stays a WARNING (an unseen-but-valid prop is
// possible). Skips raw-code types and any type with no known attributes (zero knowledge → no basis to flag).
export const checkTypeProps = (
  type: string,
  props: Record<string, unknown> | undefined,
  path: string,
  ctx: ValidationCtx
): void => {
  if (!props || RAW_CODE_TYPES.has(type)) {
    return;
  }

  const meta = ctx.typeMeta.get(type);
  // A default type's authoritative attribute set; else the observed props (lenient basis).
  const known = meta && meta.attributes.size > 0 ? meta.attributes : ctx.typeProps.get(type);
  if (!known || known.size === 0) {
    return;
  }

  const strict = meta?.custom === false;
  for (const key of Object.keys(props)) {
    if (key === 'subType' || known.has(key)) {
      continue;
    }

    if (strict) {
      ctx.errors.push({
        path,
        message: `Type "${type}" has no attribute "${key}"`,
        hint: `Valid attributes: ${[...known].sort().join(', ')}`,
        validValues: [...known].sort()
      });
    } else {
      warnOnce(
        ctx,
        `Type "${type}" has no observed prop "${key}" at ${path} (known: ${[...known].sort().join(', ')}). ` +
          'It may still be valid — verify against plitzi://types.'
      );
    }
  }
};

// Warn when an element applies a variant its class does not declare (and the batch does not create). Precise: we
// know the class's declared variants, so a hallucinated name (e.g. a "primary" that no definition defines) is
// caught — but it stays a warning because the batch may add it, or a global/plugin variant may exist.
export const checkVariantApplication = (
  initialState: InitialStateInput | undefined,
  path: string,
  ctx: ValidationCtx
): void => {
  for (const [cls, selectors] of Object.entries(initialState?.styleVariant ?? {})) {
    const declared = definitionVariantNames(ctx.style, cls);
    const batch = ctx.batchVariants.get(cls);
    for (const [selector, variant] of Object.entries(selectors)) {
      const names = Array.isArray(variant) ? variant : [variant];
      for (const name of names) {
        const known = (declared?.[selector]?.includes(name) ?? false) || (batch?.has(name) ?? false);
        if (!known) {
          const avail = declared
            ? ` (declares: ${Object.entries(declared)
                .map(([s, v]) => `${s}:${v.join('/')}`)
                .join(', ')})`
            : '';
          warnOnce(
            ctx,
            `Element applies variant "${name}" on class "${cls}" (${selector}) at ${path}, but that class defines ` +
              `no such variant${avail}. Create it via upsertDefinition/patchDefinition "variants", or fix the name.`
          );
        }
      }
    }
  }
};

// A raw-markup prop is injected verbatim (blockHtml renders it with dangerouslySetInnerHTML, and the SDK's
// previewMode defaults on), so a <script>, a javascript: URL or an inline on* handler in it RUNS. In a space that
// is the point of the escape hatch; in a WIDGET the markup lands inside the host's chat UI, where the only thing
// worth authoring raw is inert markup — an inline <svg>. Behaviour there has its own ops (upsertInteractionFlow).
const EXECUTABLE_MARKUP = /<script\b|\son[a-z]+\s*=|javascript:/i;

export const checkRawMarkup = (
  type: string,
  props: Record<string, unknown> | undefined,
  path: string,
  ctx: ValidationCtx
): void => {
  if (ctx.mode !== 'widget' || !props || !RAW_CODE_TYPES.has(type)) {
    return;
  }

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && EXECUTABLE_MARKUP.test(value)) {
      ctx.errors.push({
        path: `${path}.props.${key}`,
        message: `Executable markup in a "${type}" prop is not allowed in a widget`,
        hint:
          'A widget renders inside the host UI, so <script>, javascript: URLs and inline on* handlers are ' +
          'rejected. Keep the markup inert (an inline <svg> is what this type is for) and wire behaviour with ' +
          'upsertInteractionFlow.'
      });
    }
  }
};

const checkElementProps = (element: ElementInput, path: string, ctx: ValidationCtx): void => {
  checkRawMarkup(element.type, element.props, path, ctx);
  if (!element.props || RAW_CODE_TYPES.has(element.type)) {
    return;
  }

  for (const [key, value] of Object.entries(element.props)) {
    if (typeof value === 'string') {
      checkVarRefs(value, `${path}.props.${key}`, ctx);
    }
  }

  checkTypeProps(element.type, element.props, path, ctx);
};

export const checkElementInput = (element: ElementInput, path: string, ctx: ValidationCtx, seen: Set<string>): void => {
  checkIdRef(element.ref, `${path}.ref`, ctx);
  if (seen.has(element.ref)) {
    ctx.errors.push({
      path: `${path}.ref`,
      message: `Duplicate ref "${element.ref}" in this batch`,
      hint: 'Use a unique ref'
    });
  }

  seen.add(element.ref);

  if (!element.type) {
    ctx.errors.push({
      path: `${path}.type`,
      message: 'Element type is required',
      hint: 'Read plitzi://types for known types'
    });
  } else if (!ctx.knownTypes.has(element.type)) {
    ctx.warnings.push(`Type "${element.type}" was not seen in this space; ensure a plugin provides it (${path}.type).`);
  }

  checkElementProps(element, path, ctx);
  element.children?.forEach((child, i) => checkElementInput(child, `${path}.children[${i}]`, ctx, seen));
};
