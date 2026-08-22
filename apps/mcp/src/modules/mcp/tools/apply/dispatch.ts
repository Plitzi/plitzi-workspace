import { fail } from '../../helpers';
import { isStyleOp } from '../operations';
import * as actions from '../operations/actions';
import * as connectors from '../operations/connectors';
import * as schema from '../operations/schema';
import * as style from '../operations/style';

import type { OpResult } from '../../helpers';
import type { Space } from '../../helpers';
import type { Env, MutationOutcome } from '../../types';
import type { Operation } from '../operations';

const executeOp = (space: Space, env: Env, op: Operation): OpResult => {
  switch (op.type) {
    case 'upsertElement':
      return schema.upsertElement(space, env, op);
    case 'patchElement':
      return schema.patchElement(space, env, op);
    case 'deleteElement':
      return schema.deleteElement(space, env, op);
    case 'moveElement':
      return schema.moveElement(space, env, op);
    case 'upsertPage':
      return schema.upsertPage(space, env, op);
    case 'deletePage':
      return schema.deletePage(space, env, op);
    case 'upsertFolder':
      return schema.upsertFolder(space, env, op);
    case 'deleteFolder':
      return schema.deleteFolder(space, env, op);
    case 'upsertVariable':
      return schema.upsertVariable(space, env, op);
    case 'deleteVariable':
      return schema.deleteVariable(space, env, op);
    case 'upsertBinding':
      return schema.upsertBinding(space, env, op);
    case 'patchBinding':
      return schema.patchBinding(space, env, op);
    case 'deleteBinding':
      return schema.deleteBinding(space, env, op);
    case 'upsertInteractionFlow':
      return schema.upsertInteractionFlow(space, env, op);
    case 'patchInteractionNode':
      return schema.patchInteractionNode(space, env, op);
    case 'deleteInteraction':
      return schema.deleteInteraction(space, env, op);
    case 'patchSettings':
      return schema.patchSettings(space, env, op);
    case 'upsertDefinition':
      return style.upsertDefinition(space, env, op);
    case 'upsertDefinitions':
      return style.upsertDefinitions(space, env, op);
    case 'patchDefinition':
      return style.patchDefinition(space, env, op);
    case 'deleteDefinition':
      return style.deleteDefinition(space, env, op);
    case 'upsertGlobalStyle':
      return style.upsertGlobalStyle(space, env, op);
    case 'patchGlobalStyle':
      return style.patchGlobalStyle(space, env, op);
    case 'deleteGlobalStyle':
      return style.deleteGlobalStyle(space, env, op);
    case 'upsertIdStyle':
      return style.upsertIdStyle(space, env, op);
    case 'patchIdStyle':
      return style.patchIdStyle(space, env, op);
    case 'deleteIdStyle':
      return style.deleteIdStyle(space, env, op);
    case 'upsertStyleVariable':
      return style.upsertStyleVariable(space, env, op);
    case 'deleteStyleVariable':
      return style.deleteStyleVariable(space, env, op);
    case 'upsertConnector':
      return connectors.upsertConnector(space, env, op);
    case 'patchConnector':
      return connectors.patchConnector(space, env, op);
    case 'deleteConnector':
      return connectors.deleteConnector(space, env, op);
    case 'upsertAction':
      return actions.upsertAction(space, env, op);
    case 'patchAction':
      return actions.patchAction(space, env, op);
    case 'deleteAction':
      return actions.deleteAction(space, env, op);
    default:
      return fail('type', `Unknown operation "${(op as { type: string }).type}"`, 'See the Operation union');
  }
};

/** Apply operations in order to the space (mutating it). Records which schema(s) changed so the caller can
 *  persist each independently. Stops collecting counts for a failed op but records its errors. */
export const applyOperations = (space: Space, env: Env, ops: Operation[]): MutationOutcome => {
  const outcome: MutationOutcome = {
    created: 0,
    updated: 0,
    deleted: 0,
    staleResources: [],
    elementRefs: [],
    errors: [],
    changedSchema: false,
    changedStyle: false,
    changedConnectors: [],
    deletedConnectors: [],
    changedActions: [],
    deletedActions: []
  };
  const stale = new Set<string>();
  const elements = new Set<string>();
  const savedConnectors = new Set<string>();
  const droppedConnectors = new Set<string>();
  const savedActions = new Set<string>();
  const droppedActions = new Set<string>();

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const result = executeOp(space, env, op);
    if (result.errors) {
      outcome.errors.push(...result.errors.map(e => ({ ...e, path: `operations[${i}].${e.path}` })));
      continue;
    }

    // Which store this op dirtied, so the caller persists only what changed. Connectors are tracked by id rather
    // than a flag: they are one row each, so a batch that touched two of them must save exactly those two — and a
    // connector created and then deleted in the same batch has to leave both sets consistent.
    switch (op.type) {
      case 'upsertConnector':
      case 'patchConnector':
        droppedConnectors.delete(op.ref);
        savedConnectors.add(op.ref);
        break;
      case 'deleteConnector':
        savedConnectors.delete(op.ref);
        droppedConnectors.add(op.ref);
        break;
      case 'upsertAction':
      case 'patchAction':
        droppedActions.delete(op.ref);
        savedActions.add(op.ref);
        break;
      case 'deleteAction':
        savedActions.delete(op.ref);
        droppedActions.add(op.ref);
        break;
      default:
        if (isStyleOp(op.type)) {
          outcome.changedStyle = true;
        } else {
          outcome.changedSchema = true;
        }
    }

    // NOTE: the per-request index/memo is NOT dropped here. It only goes stale when an op changes what the index
    // keys on — element/page membership, an idRef, or a page's slug/name/default. Those handlers invalidate at the
    // exact mutation point (see createElement/ensureIdRef, delete*, upsertPage). A pure prop/style/interaction
    // patch leaves the index valid, so a large patch-only batch resolves every ref in O(1) with no rebuild.

    outcome.created += result.created;
    outcome.updated += result.updated;
    outcome.deleted += result.deleted;
    for (const uri of result.staleResources) {
      stale.add(uri);
    }

    for (const ref of result.elementRefs ?? []) {
      elements.add(ref);
    }
  }

  outcome.staleResources = Array.from(stale);
  outcome.elementRefs = Array.from(elements);
  outcome.changedConnectors = Array.from(savedConnectors);
  outcome.deletedConnectors = Array.from(droppedConnectors);
  outcome.changedActions = Array.from(savedActions);
  outcome.deletedActions = Array.from(droppedActions);

  return outcome;
};
