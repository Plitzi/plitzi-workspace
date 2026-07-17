import { isValidIdRef } from '@plitzi/sdk-schema/helpers/idRef';

import {
  findFolderByRef,
  findPageByRef,
  folderAncestorIds,
  getPageElements,
  pageFoldersOf,
  pageRefOf,
  resolveRef,
  routeParamNames,
  slugRouteParams
} from '../../helpers';
import { buildTypeRegistry, expandShorthand, isCssProperty, suggestCssProperty } from '../../resources';
import { observedDataSources, observedInteractionActions } from '../operations/schema/observed';
import { definitionVariantNames } from '../operations/style/translator';

import type { Space } from '../../helpers';
import type { ValidationError, ValidationResult } from '../../types';
import type { DefinitionSlotPatch, ElementInput, Operation } from '../operations';
import type { InitialStateInput } from '../operations/schema/shared';
import type { Style } from '@plitzi/sdk-shared';

// Wider than the idRef charset (`isValidIdRef`): this also covers refs that are NOT idRefs — a raw element id, a
// style class ref, a componentType, a variable name.
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

interface ValidationCtx {
  errors: ValidationError[];
  warnings: string[];
  warned: Set<string>;
  knownTypes: Set<string>;
  typeProps: Map<string, Set<string>>; // observed prop keys per element type (I5)
  schemaVars: Set<string>; // valid {{name}}: space schema variables ∪ page route params ∪ batch-declared
  styleVars: Set<string>; // valid var(--name): design tokens across all categories
  style: Style; // to check that an applied variant is actually declared on its class
  batchVariants: Map<string, Set<string>>; // variant names each class declares within this batch (class → names)
  observedActions: Set<string>; // interaction actions seen anywhere in the space (lenient warning basis)
  observedSources: Set<string>; // binding source paths seen anywhere in the space (lenient warning basis)
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

// Warn when an element applies a variant its class does not declare (and the batch does not create). Precise: we
// know the class's declared variants, so a hallucinated name (e.g. a "primary" that no definition defines) is
// caught — but it stays a warning because the batch may add it, or a global/plugin variant may exist.
const checkVariantApplication = (
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

const checkObservedName = (
  value: string | undefined,
  observed: Set<string>,
  kind: string,
  resource: string,
  path: string,
  ctx: ValidationCtx
): void => {
  if (!value || observed.size === 0 || observed.has(value)) {
    return;
  }

  warnOnce(
    ctx,
    `${kind} "${value}" at ${path} was not seen in this space. Verify against ${resource}; it may still be valid.`
  );
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

// A ref on a NEW element, which is stored verbatim as its idRef. Checked here so the whole batch reports at once;
// the handler re-checks at write time, where it also knows the ref is not already taken by another element.
const checkIdRef = (ref: string, path: string, ctx: ValidationCtx): void => {
  checkRef(ref, path, ctx);
  if (ref && REF_RE.test(ref) && !isValidIdRef(ref)) {
    ctx.errors.push({
      path,
      message: `Ref "${ref}" is not a valid idRef`,
      hint:
        'Use only letters, numbers and hyphens (e.g. "hero-cta"). This ref becomes the element idRef, which the ' +
        'runtime embeds in source names like `apiContainer_<idRef>.field` and in interaction targets — a dot or ' +
        'an underscore would break those paths.'
    });
  }
};

// Accepts a patch map too: a null value marks a property for removal (patchDefinition), which needs no key/value
// validation, so it is dropped before checking.
const checkCss = (css: Record<string, string | number | null> | undefined, path: string, ctx: ValidationCtx): void => {
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
const checkSlotCss = (slot: DefinitionSlotPatch, path: string, ctx: ValidationCtx): void => {
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

// Folder refs the batch itself creates via upsertFolder, so a later op (a page joining it, or a nested folder) can
// target the new folder in the same apply without a false "folder does not exist".
const batchDeclaredFolders = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  for (const op of ops) {
    if (op.type === 'upsertFolder') {
      refs.add(op.ref);
    }
  }

  return refs;
};

// Variant names each class declares within this same batch (upsertDefinition/patchDefinition), so applying a
// variant an earlier op in the batch just created does not false-warn.
const batchDeclaredVariants = (ops: Operation[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const op of ops) {
    if (op.type !== 'upsertDefinition' && op.type !== 'patchDefinition') {
      continue;
    }

    const names = new Set<string>(Object.keys(op.variants ?? {}));
    for (const slot of Object.values(op.slots ?? {})) {
      for (const name of Object.keys(slot.variants ?? {})) {
        names.add(name);
      }
    }

    if (names.size > 0) {
      map.set(op.ref, new Set([...(map.get(op.ref) ?? []), ...names]));
    }
  }

  return map;
};

export const validateOperations = (space: Space, ops: Operation[]): ValidationResult => {
  const registry = buildTypeRegistry(space.schema);
  const batchPages = batchDeclaredPages(ops);
  const batchFolders = batchDeclaredFolders(ops);
  const folderRefs = (): unknown[] => pageFoldersOf(space.schema).map(f => f.id);
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
    styleVars: new Set(Object.values(space.style.variables).flatMap(group => Object.keys(group))),
    style: space.style,
    batchVariants: batchDeclaredVariants(ops),
    observedActions: observedInteractionActions(space.schema),
    observedSources: observedDataSources(space.schema)
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
        op.type === 'moveElement' ||
        op.type === 'upsertBinding' ||
        op.type === 'patchBinding' ||
        op.type === 'deleteBinding' ||
        op.type === 'upsertInteractionFlow' ||
        op.type === 'patchInteractionNode' ||
        op.type === 'deleteInteraction') &&
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
        checkVariantApplication(op.element.initialState, `${base}.element.initialState`, ctx);
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

        checkVariantApplication(op.initialState, `${base}.initialState`, ctx);
        break;
      }
      case 'upsertDefinition':
      case 'patchDefinition': {
        const { type, ref, slots, ...slot } = op;
        void type;
        checkRef(ref, `${base}.ref`, ctx);
        checkSlotCss(slot, base, ctx);
        for (const [slotName, slotDef] of Object.entries(slots ?? {})) {
          checkSlotCss(slotDef, `${base}.slots.${slotName}`, ctx);
        }

        break;
      }
      case 'upsertGlobalStyle':
      case 'patchGlobalStyle': {
        const { type, componentType, slots, ...slot } = op;
        void type;
        checkRef(componentType, `${base}.componentType`, ctx);
        checkSlotCss(slot, base, ctx);
        for (const [slotName, slotDef] of Object.entries(slots ?? {})) {
          checkSlotCss(slotDef, `${base}.slots.${slotName}`, ctx);
        }

        break;
      }
      case 'deleteGlobalStyle':
        checkRef(op.componentType, `${base}.componentType`, ctx);
        break;
      case 'upsertPage':
        checkRef(op.ref, `${base}.ref`, ctx);
        // A non-empty folder ref must resolve to an existing folder (or one created earlier in the batch); '' and
        // null both mean "root" and are always valid. This is what keeps a page's folder either '' or a real id.
        if (typeof op.folder === 'string' && op.folder !== '') {
          if (!findFolderByRef(space.schema, op.folder) && !batchFolders.has(op.folder)) {
            ctx.errors.push({
              path: `${base}.folder`,
              message: `Folder "${op.folder}" does not exist`,
              hint: 'Create it with upsertFolder earlier in the same batch, or read plitzi://folders for valid refs',
              validValues: folderRefs()
            });
          }
        }

        break;
      case 'upsertFolder': {
        checkRef(op.ref, `${base}.ref`, ctx);
        if (typeof op.parentId === 'string') {
          checkRef(op.parentId, `${base}.parentId`, ctx);
          const parent = findFolderByRef(space.schema, op.parentId);
          if (!parent && !batchFolders.has(op.parentId)) {
            ctx.errors.push({
              path: `${base}.parentId`,
              message: `Parent folder "${op.parentId}" does not exist`,
              hint: 'Create the parent with upsertFolder first, or read plitzi://folders for valid refs',
              validValues: folderRefs()
            });
          }

          const selfId = findFolderByRef(space.schema, op.ref)?.id ?? op.ref;
          const parentId = parent?.id ?? op.parentId;
          if (
            parentId === selfId ||
            (parent && folderAncestorIds(pageFoldersOf(space.schema), parent.id).includes(selfId))
          ) {
            ctx.errors.push({
              path: `${base}.parentId`,
              message: `Folder "${op.ref}" cannot be nested under itself or one of its descendants`,
              hint: 'Choose a parent that is not this folder or below it'
            });
          }
        }

        break;
      }
      case 'deleteDefinition':
      case 'deleteFolder':
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
      case 'upsertBinding':
        checkRef(op.ref, `${base}.ref`, ctx);
        checkObservedName(
          op.binding.source,
          ctx.observedSources,
          'Data source',
          'plitzi://data-sources',
          `${base}.binding.source`,
          ctx
        );
        break;
      case 'patchBinding':
        checkRef(op.ref, `${base}.ref`, ctx);
        checkObservedName(
          op.source,
          ctx.observedSources,
          'Data source',
          'plitzi://data-sources',
          `${base}.source`,
          ctx
        );
        break;
      case 'deleteBinding':
        checkRef(op.ref, `${base}.ref`, ctx);
        break;
      case 'upsertInteractionFlow':
        checkRef(op.ref, `${base}.ref`, ctx);
        if (op.nodes[0] && op.nodes[0].nodeType !== 'trigger') {
          ctx.errors.push({
            path: `${base}.nodes[0].nodeType`,
            message: 'The first node of a flow must be a trigger',
            hint: 'Put the trigger first; the callbacks/utilities that run after it follow in order'
          });
        }

        op.nodes.forEach((node, n) =>
          checkObservedName(
            node.action,
            ctx.observedActions,
            'Interaction action',
            'plitzi://interactions',
            `${base}.nodes[${n}].action`,
            ctx
          )
        );
        break;
      case 'patchInteractionNode':
        checkRef(op.ref, `${base}.ref`, ctx);
        checkObservedName(
          op.action,
          ctx.observedActions,
          'Interaction action',
          'plitzi://interactions',
          `${base}.action`,
          ctx
        );
        break;
      case 'deleteInteraction':
        checkRef(op.ref, `${base}.ref`, ctx);
        if (Boolean(op.flowId) === Boolean(op.nodeId)) {
          ctx.errors.push({
            path: `${base}.nodeId`,
            message: 'Provide exactly one of flowId or nodeId',
            hint: 'flowId removes a whole flow; nodeId removes a single step'
          });
        }

        break;
      default:
        break;
    }
  });

  return { valid: ctx.errors.length === 0, errors: ctx.errors, warnings: ctx.warnings };
};
