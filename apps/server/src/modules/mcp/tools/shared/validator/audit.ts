import { checkBindingSourceScope, checkBindingTarget, checkBindingTransformers } from './bindings';
import { checkSlotCss } from './css';
import { checkVariantApplication } from './elements';
import { buildValidationCtx } from './index';
import { checkInteractionNode } from './interactions';
import { elementRefOf, findElementByRef } from '../../../helpers';
import { definitionToAI, globalStyleToAI, idStyleToAI } from '../../operations/style/translator';

import type { ValidationCtx } from './context';
import type { Space } from '../../../helpers';
import type { AIDefinition, ValidationResult } from '../../../types';
import type { Operation } from '../../operations';
import type { InitialStateInput, InteractionNodeInput } from '../../operations/schema/shared';
import type { Element, ElementInteraction } from '@plitzi/sdk-shared';

// Post-apply RESOURCE AUDIT. The per-op validator only checks the data the agent WRITES; this checks the STORED
// state of every resource the batch TOUCHES, on the resulting (post-apply) draft. So when the agent edits an
// element/definition, any malformation ALREADY present in it (a broken transformer, an out-of-scope binding,
// invalid CSS, a malformed interaction node) surfaces too. Running on the post-apply draft is what lets the SAME
// batch fix it: if the fix is included the resource is clean and the save proceeds; if not, the audit's ERRORS
// block the save until it is corrected. Findings are labelled "pre-existing" so the agent never confuses them with
// its own change.

// Run a set of checks into a throwaway ctx (so they cannot early-append to the real result), then fold what they
// found into `into`, re-labelled as pre-existing. Errors stay errors (they block the save); warnings stay warnings.
const harvest = (
  ctx: ValidationCtx,
  into: ValidationResult,
  label: string,
  run: (sub: ValidationCtx) => void
): void => {
  const sub: ValidationCtx = { ...ctx, errors: [], warnings: [], warned: new Set() };
  run(sub);
  for (const e of sub.errors) {
    into.errors.push({
      path: e.path,
      message: `Pre-existing malformation in ${label}: ${e.message}`,
      hint:
        `${e.hint ? `${e.hint} ` : ''}This issue already exists in the space (NOT caused by your change), but the ` +
        'save is blocked until you fix it too, in this same batch.',
      ...(e.validValues ? { validValues: e.validValues } : {})
    });
  }

  for (const w of sub.warnings) {
    const message = `Pre-existing issue in ${label} (not caused by your change, but worth fixing too): ${w}`;
    if (!into.warnings.includes(message)) {
      into.warnings.push(message);
    }
  }
};

const toNode = (id: string, node: ElementInteraction): InteractionNodeInput => ({
  id,
  title: node.title,
  nodeType: node.type,
  action: node.action,
  params: node.params,
  enabled: node.enabled,
  when: node.when,
  elementId: node.elementId ?? undefined,
  preview: node.preview
});

const auditElement = (space: Space, sub: ValidationCtx, el: Element): void => {
  const hostRef = elementRefOf(el);
  const base = `element "${hostRef}"`;

  for (const [category, list] of Object.entries(el.definition.bindings ?? {})) {
    for (const binding of list) {
      const path = `${base}.bindings.${category}[to=${binding.to}]`;
      checkBindingTransformers(binding.transformers, `${path}.transformers`, sub);
      checkBindingSourceScope(space, sub, hostRef, binding.source, `${path}.source`);
      checkBindingTarget(hostRef, category, binding.to, path, sub);
    }
  }

  for (const [id, node] of Object.entries(el.definition.interactions ?? {})) {
    checkInteractionNode(toNode(id, node), `${base}.interactions.${id}`, sub, hostRef);
  }

  checkVariantApplication(el.definition.initialState as InitialStateInput | undefined, `${base}.initialState`, sub);
};

const auditDefinitionCss = (sub: ValidationCtx, label: string, def: AIDefinition): void => {
  const { ref: _ref, slots, ...slot } = def;
  void _ref;
  checkSlotCss(slot, label, sub);
  for (const [name, slotDef] of Object.entries(slots ?? {})) {
    checkSlotCss(slotDef, `${label}.slots.${name}`, sub);
  }
};

// The distinct element refs and style resources the batch touches (an existing element/definition to audit). A
// created element is audited too — post-apply it exists; its new content passed the per-op checks, so it stays
// clean. A deleted element is gone from the draft and simply does not resolve.
interface Touched {
  elementRefs: Set<string>;
  definitions: Set<string>;
  globalStyles: Set<string>;
  idStyles: Set<string>;
}

const collectTouched = (ops: Operation[]): Touched => {
  const touched: Touched = {
    elementRefs: new Set(),
    definitions: new Set(),
    globalStyles: new Set(),
    idStyles: new Set()
  };
  for (const op of ops) {
    switch (op.type) {
      case 'upsertElement':
        touched.elementRefs.add(op.element.ref);
        break;
      case 'patchElement':
      case 'moveElement':
      case 'upsertBinding':
      case 'patchBinding':
      case 'deleteBinding':
      case 'upsertInteractionFlow':
      case 'patchInteractionNode':
      case 'deleteInteraction':
        touched.elementRefs.add(op.ref);
        break;
      case 'upsertDefinition':
      case 'patchDefinition':
        touched.definitions.add(op.ref);
        break;
      case 'upsertGlobalStyle':
      case 'patchGlobalStyle':
        touched.globalStyles.add(op.componentType);
        break;
      case 'upsertIdStyle':
      case 'patchIdStyle':
        touched.idStyles.add(op.targetId);
        break;
      default:
        break;
    }
  }

  return touched;
};

export const auditResources = (space: Space, ops: Operation[]): ValidationResult => {
  const ctx = buildValidationCtx(space, ops);
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const touched = collectTouched(ops);

  const seenElements = new Set<string>();
  for (const ref of touched.elementRefs) {
    const el = findElementByRef(space.schema, ref);
    if (!el || seenElements.has(el.id)) {
      continue;
    }

    seenElements.add(el.id);
    harvest(ctx, result, `element "${elementRefOf(el)}"`, sub => auditElement(space, sub, el));
  }

  for (const ref of touched.definitions) {
    const def = definitionToAI(space.style, ref);
    if (def) {
      harvest(ctx, result, `definition "${ref}"`, sub => auditDefinitionCss(sub, `definition "${ref}"`, def));
    }
  }

  for (const componentType of touched.globalStyles) {
    const def = globalStyleToAI(space.style, componentType);
    if (def) {
      harvest(ctx, result, `global style "${componentType}"`, sub =>
        auditDefinitionCss(sub, `global style "${componentType}"`, def)
      );
    }
  }

  for (const targetId of touched.idStyles) {
    const def = idStyleToAI(space.style, targetId);
    if (def) {
      harvest(ctx, result, `id style "#${targetId}"`, sub => auditDefinitionCss(sub, `id style "#${targetId}"`, def));
    }
  }

  result.valid = result.errors.length === 0;

  return result;
};
