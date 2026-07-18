import { batchDeclaredFolders, batchDeclaredPages, batchDeclaredVariants, batchDeclaredVars } from './batch';
import { checkObservedName, checkVarRefs, warnOnce } from './context';
import { checkSlotCss } from './css';
import { checkElementInput, checkTypeProps, checkVariantApplication } from './elements';
import { checkRef } from './refs';
import { BUILTIN_GLOBAL_CALLBACKS, observedDataSources, observedInteractionActions } from '../../../catalogs';
import {
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

import type { ValidationCtx } from './context';
import type { Space } from '../../../helpers';
import type { ValidationResult } from '../../../types';
import type { Operation } from '../../operations';

// The batch validator: builds the shared context from the space, then runs the per-op checks (split across the
// sibling modules: refs, css, elements, batch, context) and the pageRef existence guard. The only export a
// consumer needs is validateOperations — importers reference the folder (./shared/validator), which resolves here.

const MAX_OPS = 100;
const STYLE_CATEGORIES = ['color', 'spacing', 'shadow', 'custom'];

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

        op.nodes.forEach((node, n) => {
          checkObservedName(
            node.action,
            ctx.observedActions,
            'Interaction action',
            'plitzi://interactions',
            `${base}.nodes[${n}].action`,
            ctx
          );

          // A built-in globalCallback is registered on its source module — the MCP pins elementId to that source.
          // Warn (not fail) when the agent points it at the host element instead, the common mistake.
          const builtin = node.nodeType === 'globalCallback' ? BUILTIN_GLOBAL_CALLBACKS[node.action] : undefined;
          if (builtin && node.elementId !== undefined && node.elementId !== builtin.source) {
            warnOnce(
              ctx,
              `Global callback "${node.action}" at ${base}.nodes[${n}] is registered on "${builtin.source}", not on ` +
                `"${node.elementId}". Omit elementId (the MCP sets "${builtin.source}") or set it to "${builtin.source}".`
            );
          }
        });
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
