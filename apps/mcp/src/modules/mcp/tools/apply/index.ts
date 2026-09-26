import { z } from 'zod';

import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { changedResources, conflictMessage, detectConflicts, resolvedElements } from './writeResult';
import { environment, operations } from '../operations';
import { draftBatch } from '../shared/draftBatch';
import { defineTool } from '../shared/tool';

import type { Space } from '../../helpers';
import type { ApplyInput, Env, Persisters, WriteResponse } from '../../types';

export const applyShape = {
  environment,
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Validate and apply in memory only, WITHOUT persisting. Returns the same result (changed versions + full ' +
        'element detail) so you can inspect the outcome and decide on more changes before committing for real.'
    ),
  expectedResourceVersions: z
    .record(z.string(), z.string())
    .optional()
    .describe('Resource URI → the stateVersion you read; guards against concurrent edits'),
  operations
};

const noWarnings = (warnings: string[]): string[] | undefined => (warnings.length > 0 ? warnings : undefined);

export const apply = async (input: ApplyInput, space: Space, persisters?: Persisters): Promise<WriteResponse> => {
  const env = (input.environment ?? 'main') as Env;

  // First, before anything is read into a draft: a batch written against versions that have moved on is answered
  // with the conflict whatever else is wrong with it, since the agent has to read again before it can fix anything.
  const conflicts = detectConflicts(space, env, input.expectedResourceVersions);
  if (conflicts.length > 0) {
    return {
      applied: false,
      persisted: false,
      summary: { created: 0, updated: 0, deleted: 0 },
      changed: [],
      conflict: { message: conflictMessage, conflicts }
    };
  }

  // All-or-nothing: the batch runs on a copy, and a refusal at any stage discards it — nothing persists.
  const result = draftBatch(space, env, input.operations);
  if (!result.ok) {
    return {
      applied: false,
      persisted: false,
      summary: { created: 0, updated: 0, deleted: 0 },
      changed: [],
      errors: result.errors,
      warnings: noWarnings(result.warnings)
    };
  }

  const { draft, outcome, warnings } = result;

  // Dry run: everything is applied to the in-memory draft and reported (changed versions + full element detail),
  // but nothing is persisted — the agent inspects the outcome, then re-runs without dryRun to commit.
  if (input.dryRun) {
    return {
      applied: false,
      dryRun: true,
      summary: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted },
      changed: changedResources(draft, env, outcome.staleResources),
      elements: resolvedElements(draft, env, outcome.elementRefs),
      warnings: noWarnings(warnings)
    };
  }

  // Persist each schema that changed to its own store; unsaved when a changed schema has no persister.
  let persisted = true;
  if (outcome.changedSchema) {
    if (persisters?.schema) {
      await persisters.schema(draft.schema);
    } else {
      persisted = false;
    }
  }

  if (outcome.changedStyle) {
    if (persisters?.style) {
      // Compiled here, not left to the persister. The renderer serves `style.cache` and nothing else, so a document
      // stored without recompiling it is a page that keeps showing the old CSS — and the adapter contract asking
      // every deployment to remember `generateCache` made that a bug each of them could write independently, in
      // the one place where getting it wrong looks like the edit never happened. `plitzi_render` already compiled
      // it on its own path; this is the same line on the path that persists.
      draft.style.cache = generateCache(draft.style);
      await persisters.style(draft.style);
    } else {
      persisted = false;
    }
  }

  // Connectors are rows, not a document: only the ones this batch touched are written, and a delete is its own
  // call. A connector the batch created and then removed appears in neither list, so nothing is written for it.
  for (const id of outcome.changedConnectors) {
    const entry = draft.connectors.find(item => item.id === id);
    if (entry && persisters?.saveConnector) {
      await persisters.saveConnector(entry);
    } else {
      persisted = false;
    }
  }

  for (const id of outcome.deletedConnectors) {
    if (persisters?.deleteConnector) {
      await persisters.deleteConnector(id);
    } else {
      persisted = false;
    }
  }

  // Actions are rows too, and follow the connectors' rule exactly: only what this batch touched is written, a
  // delete is its own call, and one created and then removed in the same batch is written nowhere.
  for (const id of outcome.changedActions) {
    const entry = draft.actions.find(item => item.id === id);
    if (entry && persisters?.saveAction) {
      await persisters.saveAction(entry);
    } else {
      persisted = false;
    }
  }

  for (const id of outcome.deletedActions) {
    if (persisters?.deleteAction) {
      await persisters.deleteAction(id);
    } else {
      persisted = false;
    }
  }

  return {
    applied: true,
    persisted,
    summary: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted },
    changed: changedResources(draft, env, outcome.staleResources),
    elements: resolvedElements(draft, env, outcome.elementRefs),
    warnings: noWarnings(warnings)
  };
};

export const applyTool = defineTool({
  name: 'plitzi_apply',
  title: 'Apply',
  description:
    'Validate, apply and persist a batch of operations atomically. Returns the changed resources and their new ' +
    'versions, plus the full detail of every element it created or updated. Pass dryRun to apply in memory only ' +
    '(inspect the outcome without committing). Rejects the whole batch on any error or version conflict — INCLUDING ' +
    'a pre-existing malformation in any resource the batch touches (fix it in the same batch to unblock the save).',
  inputShape: applyShape,
  access: 'write',
  run: (input, ctx) => apply({ ...input, environment: ctx.env }, ctx.space, ctx.persisters)
});
