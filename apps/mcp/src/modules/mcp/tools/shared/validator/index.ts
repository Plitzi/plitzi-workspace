import { isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';

import {
  batchDeclaredElements,
  batchDeclaredFolders,
  batchDeclaredPages,
  batchDeclaredVariants,
  batchDeclaredVars
} from './batch';
import { checkBindingSourceScope, checkBindingTarget, checkBindingTransformers } from './bindings';
import { batchDeclaredConnectors, checkConnectorOp, checkProviderElement } from './connectors';
import { checkObservedName, checkVarRefs, warnOnce } from './context';
import { checkSlotCss } from './css';
import { checkElementInput, checkRawMarkup, checkTypeProps, checkVariantApplication } from './elements';
import { checkInteractionNode } from './interactions';
import { checkRef } from './refs';
import { elementTypeNames, observedDataSources, observedInteractionActions } from '../../../catalogs';
import {
  findElementByRef,
  findFolderByRef,
  findPageByRef,
  folderAncestorIds,
  getPageElements,
  pageFoldersOf,
  resolveRef,
  routeParamNames
} from '../../../helpers';
import { buildTypeRegistry } from '../../../resources';
import { MAX_OPS } from '../../operations';

import type { TypeMeta, ValidationCtx, ValidationMode } from './context';
import type { Space } from '../../../helpers';
import type { ValidationResult } from '../../../types';
import type { Operation } from '../../operations';
import type { ElementInput, InteractionNodeInput } from '../../operations/schema/shared';
import type { ComponentCatalog } from '@plitzi/sdk-shared';

// The batch validator: builds the shared context from the space, then runs the per-op checks (split across the
// sibling modules: refs, css, elements, batch, context) and the pageRef existence guard. The only export a
// consumer needs is validateOperations — importers reference the folder (./shared/validator), which resolves here.

const STYLE_CATEGORIES = ['color', 'spacing', 'shadow', 'custom'];

/** The element type that reads through a connector. Only this one carries the connector attributes, so only it is
 *  worth cross-checking against the connector store. */
const PROVIDER_TYPE = 'apiContainer';

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

/** The shared validation context, derived from a space (+ the batch's ops, for batch-declared names). Extracted so
 *  the post-apply resource audit (auditResources) can run the same checks against the resulting draft. */
export const buildValidationCtx = (space: Space, ops: Operation[], mode: ValidationMode = 'space'): ValidationCtx => {
  const registry = buildTypeRegistry(space.schema, space.catalog);
  const batchElements = batchDeclaredElements(ops);

  return {
    mode,
    errors: [],
    warnings: [],
    warned: new Set(),
    // Built-in element types (container, heading, image…) are always available from the SDK — no plugin needed — so
    // they are always "known", even in a space that has no instance of them yet or (plitzi_render) a catalog-less seed
    // space. Without this the render tool warns "ensure a plugin provides it" for every standard element.
    knownTypes: new Set([...Object.keys(registry.types), ...elementTypeNames]),
    typeProps: new Map(Object.entries(registry.types).map(([type, info]) => [type, new Set(Object.keys(info.props))])),
    typeMeta: buildTypeMeta(space.catalog),
    elementType: ref => (findElementByRef(space.schema, ref) ?? findPageByRef(space.schema, ref))?.definition.type,
    elementExists: ref =>
      batchElements.has(ref) || Boolean(findElementByRef(space.schema, ref) ?? findPageByRef(space.schema, ref)),
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
};

export const validateOperations = (
  space: Space,
  ops: Operation[],
  mode: ValidationMode = 'space'
): ValidationResult => {
  const batchPages = batchDeclaredPages(ops);
  const batchFolders = batchDeclaredFolders(ops);
  const batchConnectors = batchDeclaredConnectors(ops);
  const folderRefs = (): unknown[] => pageFoldersOf(space.schema).map(f => f.id);
  const ctx = buildValidationCtx(space, ops, mode);

  // Every provider element in an input tree, checked against the connector it names. Walks the nested children
  // because upsertElement authors a subtree, and a provider is as often a child of the layout as its root.
  const checkProviders = (input: ElementInput, base: string): void => {
    if (input.type === PROVIDER_TYPE) {
      checkProviderElement(space, ctx, input.ref, input.runtime, input.props, batchConnectors, base);
    }

    (input.children ?? []).forEach((child, i) => checkProviders(child, `${base}.children[${i}]`));
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
        const validRefs = getPageElements(space.schema).map(page => page.id);
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
        checkProviders(op.element, `${base}.element`);
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
            checkRawMarkup(target.definition.type, op.props, base, ctx);
            checkTypeProps(target.definition.type, op.props, base, ctx);
          }
        }

        checkVariantApplication(op.initialState, `${base}.initialState`, ctx);
        // Checked on the MERGED element (stored props/runtime ∪ the patch): a patch that only flips runtime, or
        // only names the connector, is exactly how a provider gets wired, and either half alone means nothing.
        if (target && target.definition.type === PROVIDER_TYPE) {
          checkProviderElement(
            space,
            ctx,
            op.ref,
            op.runtime ?? target.definition.runtime,
            { ...target.attributes, ...op.props },
            batchConnectors,
            base
          );
        }

        break;
      }
      case 'upsertDefinitions': {
        const entries = Object.entries(op.definitions);
        if (entries.length === 0) {
          ctx.errors.push({
            path: `${base}.definitions`,
            message: 'This operation declares no classes',
            hint: 'Key each class by its name: { "definitions": { "card": { "desktop": { … } } } }'
          });
        }

        for (const [ref, { slots, ...slot }] of entries) {
          const entry = `${base}.definitions.${ref}`;
          checkRef(ref, entry, ctx);
          checkSlotCss(slot, entry, ctx);
          for (const [slotName, slotDef] of Object.entries(slots ?? {})) {
            checkSlotCss(slotDef, `${entry}.slots.${slotName}`, ctx);
          }
        }

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
        // Nudge toward giving a new page an explicit slug (good practice: a clean, stable route). Only on create,
        // and lenient — the ref is used as a fallback slug, so a missing slug never fails the batch.
        if (op.slug === undefined && !findPageByRef(space.schema, op.ref)) {
          warnOnce(
            ctx,
            `Page "${op.ref}" is being created without a slug. Set a slug for a clean, stable URL (good practice); ` +
              'the page ref is used as a fallback.'
          );
        }

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
        checkBindingSourceScope(space, ctx, op.ref, op.binding.source, `${base}.binding.source`);
        checkBindingTransformers(op.binding.transformers, `${base}.binding.transformers`, ctx);
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
        if (op.source !== undefined) {
          checkBindingSourceScope(space, ctx, op.ref, op.source, `${base}.source`);
        }

        checkBindingTransformers(op.transformers, `${base}.transformers`, ctx);
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

        // A flow is stored as a MAP keyed by step id, so two steps named the same do not both land — the second
        // replaces the first, and the flow that runs is shorter than the one that was written.
        {
          const named = new Set<string>();
          op.nodes.forEach((node, n) => {
            if (!node.id) {
              return;
            }

            if (!isValidElementId(node.id)) {
              ctx.errors.push({
                path: `${base}.nodes[${n}].id`,
                message: `"${node.id}" is not a valid step name`,
                hint: 'Letters, numbers, hyphens and underscores, starting with a letter. A later step reads this one as {{ <id>.field }}, so a dot would split that path'
              });
            }

            if (named.has(node.id)) {
              ctx.errors.push({
                path: `${base}.nodes[${n}].id`,
                message: `Two steps of this flow are called "${node.id}"`,
                hint: 'A flow is keyed by step id, so the second would replace the first. Name them apart'
              });
            }

            named.add(node.id);
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
      case 'upsertConnector':
      case 'deleteConnector':
        checkRef(op.ref, `${base}.ref`, ctx);
        checkConnectorOp(space, op, base, ctx);
        break;
      case 'patchConnector':
        checkRef(op.ref, `${base}.ref`, ctx);
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
