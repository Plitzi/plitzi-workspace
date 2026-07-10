import { findPageByRef, getPageElements, pageRefOf, resolveRef, routeParamNames, slugRouteParams } from '../helpers';
import { buildTypeRegistry, expandShorthand, isCssProperty, suggestCssProperty } from '../resources';

import type { DefinitionSlotInput, ElementInput, Operation } from './operations';
import type { Space } from '../helpers';
import type { ValidationError } from '../types';

const REF_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_OPS = 100;
const STYLE_CATEGORIES = ['color', 'spacing', 'shadow', 'custom'];

// A {{name}} binding: only a bare identifier/path between the braces — never the multiline JS/JSX object
// literals that live in code-bearing element props (those never match a lone identifier).
const VAR_REF = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;
const CSS_VAR = /var\(\s*--([A-Za-z_][\w-]*)\s*\)/g;

// Types whose props carry raw JSX/HTML/JS, where `{{ ... }}` is code (e.g. JSX object shorthand), not a Plitzi
// variable reference. Their props are skipped by the {{name}} check to avoid false positives.
const RAW_CODE_TYPES = new Set(['blockJsx', 'blockHtml', 'custom']);

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

interface ValidationCtx {
  errors: ValidationError[];
  warnings: string[];
  warned: Set<string>;
  knownTypes: Set<string>;
  typeProps: Map<string, Set<string>>; // observed prop keys per element type (I5)
  schemaVars: Set<string>; // valid {{name}}: space schema variables ∪ page route params ∪ batch-declared
  styleVars: Set<string>; // valid var(--name): design tokens across all categories
}

const warnOnce = (ctx: ValidationCtx, message: string): void => {
  if (!ctx.warned.has(message)) {
    ctx.warned.add(message);
    ctx.warnings.push(message);
  }
};

const checkVarRefs = (text: string, path: string, ctx: ValidationCtx): void => {
  for (const match of text.matchAll(VAR_REF)) {
    const name = match[1];
    if (!ctx.schemaVars.has(name)) {
      warnOnce(
        ctx,
        `Unknown variable {{${name}}} at ${path}: not a space schema variable or a page route param. ` +
          'Read plitzi://schema-variables, or use a route param from the page skeleton (routeParams).'
      );
    }
  }
};

const checkStyleVarRefs = (text: string, path: string, ctx: ValidationCtx): void => {
  for (const match of text.matchAll(CSS_VAR)) {
    const name = match[1];
    if (!ctx.styleVars.has(name)) {
      const tokens = [...ctx.styleVars];
      const available =
        tokens.length > 0
          ? `Available tokens: ${tokens.slice(0, 30).join(', ')}${tokens.length > 30 ? ', …' : ''}.`
          : 'Read plitzi://style-variables for the valid token names.';
      warnOnce(ctx, `Unknown style variable var(--${name}) at ${path}: not a design token in this space. ${available}`);
    }
  }
};

// I5: warn when a prop is not among the type's OBSERVED props (plitzi://types is observed, not declared — so this
// is a warning, never a hard error: an unseen-but-valid prop is possible). Skips raw-code types and any type with
// no observed props (zero knowledge → no basis to flag).
const checkTypeProps = (
  type: string,
  props: Record<string, unknown> | undefined,
  path: string,
  ctx: ValidationCtx
): void => {
  if (!props || RAW_CODE_TYPES.has(type)) {
    return;
  }

  const known = ctx.typeProps.get(type);
  if (!known || known.size === 0) {
    return;
  }

  for (const key of Object.keys(props)) {
    if (key === 'subType' || known.has(key)) {
      continue;
    }

    warnOnce(
      ctx,
      `Type "${type}" has no observed prop "${key}" at ${path} (observed: ${[...known].sort().join(', ')}). ` +
        'It may still be valid — verify against plitzi://types.'
    );
  }
};

const checkRef = (ref: string, path: string, ctx: ValidationCtx): void => {
  if (!ref || ref.trim().length === 0) {
    ctx.errors.push({ path, message: 'Ref must not be empty', hint: 'Use a semantic name like "hero.title"' });

    return;
  }

  if (!REF_RE.test(ref)) {
    ctx.errors.push({
      path,
      message: `Ref "${ref}" has invalid characters`,
      hint: 'Allowed characters: letters, numbers, dot, hyphen, underscore'
    });
  }
};

const checkCss = (css: Record<string, string | number> | undefined, path: string, ctx: ValidationCtx): void => {
  if (!css) {
    return;
  }

  // Expand shorthands first (border, border-radius, padding…) so they validate as their longhand keys — matching
  // what persistence stores (RFC 0004 I4).
  for (const [key, value] of Object.entries(expandShorthand(css))) {
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

const checkSlotCss = (slot: DefinitionSlotInput, path: string, ctx: ValidationCtx): void => {
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

const checkElementProps = (element: ElementInput, path: string, ctx: ValidationCtx): void => {
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

const checkElementInput = (element: ElementInput, path: string, ctx: ValidationCtx, seen: Set<string>): void => {
  checkRef(element.ref, `${path}.ref`, ctx);
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

// Names an agent may legally reference within the same batch even though they are not in the space yet: variables
// and route params (page slugs) the batch itself declares. Prevents false "unknown variable" warnings.
const batchDeclaredVars = (ops: Operation[]): string[] => {
  const names: string[] = [];
  for (const op of ops) {
    if (op.type === 'upsertVariable') {
      names.push(op.name);
    } else if (op.type === 'upsertPage' && typeof op.slug === 'string') {
      names.push(...slugRouteParams(op.slug));
    }
  }

  return names;
};

// Page refs the batch itself creates via upsertPage, so a later op in the same batch can target the new page
// (e.g. "create a page AND fill it in one apply") without a false "page does not exist". Runtime still enforces
// order: an element op that runs before its page is created fails with a clear pageRef error.
const batchDeclaredPages = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  for (const op of ops) {
    if (op.type === 'upsertPage') {
      refs.add(op.ref);
    }
  }

  return refs;
};

export const validateOperations = (space: Space, ops: Operation[]): ValidationResult => {
  const registry = buildTypeRegistry(space.schema);
  const batchPages = batchDeclaredPages(ops);
  const ctx: ValidationCtx = {
    errors: [],
    warnings: [],
    warned: new Set(),
    knownTypes: new Set(Object.keys(registry.types)),
    typeProps: new Map(Object.entries(registry.types).map(([type, info]) => [type, new Set(Object.keys(info.props))])),
    schemaVars: new Set([
      ...space.schema.variables.map(v => v.name),
      ...routeParamNames(space.schema),
      ...batchDeclaredVars(ops)
    ]),
    styleVars: new Set(Object.values(space.style.variables).flatMap(group => Object.keys(group)))
  };

  if (ops.length > MAX_OPS) {
    ctx.errors.push({
      path: 'operations',
      message: `Batch has ${ops.length} operations (max ${MAX_OPS})`,
      hint: `Split into batches of at most ${MAX_OPS}`
    });
  }

  ops.forEach((op, i) => {
    const base = `operations[${i}]`;

    if (
      (op.type === 'upsertElement' ||
        op.type === 'patchElement' ||
        op.type === 'deleteElement' ||
        op.type === 'moveElement') &&
      op.pageRef
    ) {
      if (!findPageByRef(space.schema, op.pageRef) && !batchPages.has(op.pageRef)) {
        const validRefs = getPageElements(space.schema).map(pageRefOf);
        ctx.errors.push({
          path: `${base}.pageRef`,
          message: `Page "${op.pageRef}" does not exist`,
          hint: 'Use an existing page ref, or create it with upsertPage earlier in the same batch',
          validValues: validRefs
        });
      }
    }

    switch (op.type) {
      case 'upsertElement':
        checkElementInput(op.element, `${base}.element`, ctx, new Set());
        break;
      case 'patchElement': {
        checkRef(op.ref, `${base}.ref`, ctx);
        const page = findPageByRef(space.schema, op.pageRef);
        const target = page ? resolveRef(space.schema, page, op.ref) : undefined;
        if (op.props) {
          for (const [key, value] of Object.entries(op.props)) {
            if (typeof value === 'string') {
              checkVarRefs(value, `${base}.props.${key}`, ctx);
            }
          }

          if (target && target.id !== page?.id) {
            checkTypeProps(target.definition.type, op.props, base, ctx);
          }
        }

        break;
      }
      case 'upsertDefinition': {
        const { type, ref, slots, ...slot } = op;
        void type;
        checkRef(ref, `${base}.ref`, ctx);
        checkSlotCss(slot, base, ctx);
        for (const [slotName, slotDef] of Object.entries(slots ?? {})) {
          checkSlotCss(slotDef, `${base}.slots.${slotName}`, ctx);
        }

        break;
      }
      case 'deleteDefinition':
      case 'upsertPage':
      case 'deletePage':
      case 'upsertVariable':
      case 'deleteVariable':
        checkRef('ref' in op ? op.ref : op.name, `${base}.${'ref' in op ? 'ref' : 'name'}`, ctx);
        break;
      case 'upsertStyleVariable':
      case 'deleteStyleVariable':
        if (!STYLE_CATEGORIES.includes(op.category)) {
          ctx.errors.push({
            path: `${base}.category`,
            message: `Unknown style-variable category "${op.category}"`,
            hint: 'Use one of the valid categories',
            validValues: STYLE_CATEGORIES
          });
        }

        break;
      default:
        break;
    }
  });

  return { valid: ctx.errors.length === 0, errors: ctx.errors, warnings: ctx.warnings };
};
