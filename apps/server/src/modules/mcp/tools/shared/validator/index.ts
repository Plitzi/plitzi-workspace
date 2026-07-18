import { batchDeclaredFolders, batchDeclaredPages, batchDeclaredVariants, batchDeclaredVars } from './batch';
import { checkObservedName, checkVarRefs, warnOnce } from './context';
import { checkSlotCss } from './css';
import { checkElementInput, checkTypeProps, checkVariantApplication } from './elements';
import { checkInteractionNode } from './interactions';
import { checkRef } from './refs';
import { observedDataSources, observedInteractionActions } from '../../../catalogs';
import {
  findElementByRef,
  findFolderByRef,
  findPageByRef,
  folderAncestorIds,
  getPageElements,
  pageFoldersOf,
  pageRefOf,
  resolveRef,
  routeParamNames
} from '../../../helpers';
import { buildTypeRegistry } from '../../../resources';

import type { TypeMeta, ValidationCtx } from './context';
import type { Space } from '../../../helpers';
import type { ValidationResult } from '../../../types';
import type { Operation } from '../../operations';
import type { InteractionNodeInput } from '../../operations/schema/shared';
import type { ComponentCatalog } from '@plitzi/sdk-shared';

// The batch validator: builds the shared context from the space, then runs the per-op checks (split across the
// sibling modules: refs, css, elements, batch, context) and the pageRef existence guard. The only export a
// consumer needs is validateOperations — importers reference the folder (./shared/validator), which resolves here.

const MAX_OPS = 100;
const STYLE_CATEGORIES = ['color', 'spacing', 'shadow', 'custom'];

const buildTypeMeta = (catalog: ComponentCatalog | undefined): Map<string, TypeMeta> => {
  const meta = new Map<string, TypeMeta>();
  for (const [type, entry] of Object.entries(catalog ?? {})) {
    const bindingsAllowed = entry.bindingsAllowed;

    meta.set(type, {
      attributes: new Set(entry.attributes ?? []),
      styleSelectors: new Set(entry.styleSelectors ?? []),
      custom: entry.custom ?? false,
      ...(bindingsAllowed
        ? {
            bindingTargets: {
              attributes: new Set(bindingsAllowed.attributes ?? []),
              initialState: new Set(bindingsAllowed.initialState ?? [])
            }
          }
        : {})
    });
  }

  return meta;
};

// When the bound element's type declares its allowed binding targets (a plugin manifest's `bindingsAllowed`), warn
// if the `to` target is not among them. Lenient (warning): only plugin types carry this list, and a manifest is a
// best-effort snapshot. Categories other than attributes/initialState (e.g. style) carry no such list.
const checkBindingTarget = (
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

export const validateOperations = (space: Space, ops: Operation[]): ValidationResult => {
  const registry = buildTypeRegistry(space.schema, space.catalog);
  const batchPages = batchDeclaredPages(ops);
  const batchFolders = batchDeclaredFolders(ops);
  const folderRefs = (): unknown[] => pageFoldersOf(space.schema).map(f => f.id);
  const ctx: ValidationCtx = {
    errors: [],
    warnings: [],
    warned: new Set(),
    knownTypes: new Set(Object.keys(registry.types)),
    typeProps: new Map(Object.entries(registry.types).map(([type, info]) => [type, new Set(Object.keys(info.props))])),
    typeMeta: buildTypeMeta(space.catalog),
    elementType: ref => (findElementByRef(space.schema, ref) ?? findPageByRef(space.schema, ref))?.definition.type,
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
        checkBindingTarget(op.ref, op.category, op.binding.to, `${base}.binding.to`, ctx);
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
        checkBindingTarget(op.ref, op.category, op.to, `${base}.to`, ctx);
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

        op.nodes.forEach((node, n) => checkInteractionNode(node, `${base}.nodes[${n}]`, ctx, op.ref));
        break;
      case 'patchInteractionNode': {
        checkRef(op.ref, `${base}.ref`, ctx);
        // Validate the MERGED node (stored params ∪ the patch), not just the keys the agent touched: a patch merges
        // onto the existing params, so a half-fixed node (one param corrected, others still malformed) must be caught.
        // When the node cannot be resolved, fall back to the lightweight action check (apply reports the missing node).
        const existing = findElementByRef(space.schema, op.ref)?.definition.interactions?.[op.nodeId];
        if (existing) {
          const merged: InteractionNodeInput = {
            id: existing.id,
            title: op.title ?? existing.title,
            nodeType: existing.type,
            action: op.action ?? existing.action,
            params: { ...existing.params, ...(op.params ?? {}) },
            enabled: op.enabled ?? existing.enabled,
            elementId: op.elementId ?? existing.elementId ?? undefined
          };
          checkInteractionNode(merged, base, ctx, op.ref);
        } else {
          checkObservedName(
            op.action,
            ctx.observedActions,
            'Interaction action',
            'plitzi://interactions',
            `${base}.action`,
            ctx
          );
        }

        break;
      }
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
