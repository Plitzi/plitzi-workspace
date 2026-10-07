import { z } from 'zod';

import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { changedResources, conflictMessage, detectConflicts, resolvedElements } from './writeResult';
import { dataFileUri, dataUri, functionFileUri, functionsUri } from '../../helpers';
import { environment, operations } from '../operations';
import { draftBatch } from '../shared/draftBatch';
import { effectsOf } from '../shared/effects';
import { fullPage, lookAt, pageRef, viewport } from '../shared/look';
import { AGAIN, REPEATED, batchKey, forgetRefused, noteRefused, timesRefused } from '../shared/repeats';
import { defineTool, imageResult } from '../shared/tool';

import type { Space } from '../../helpers';
import type { ApplyInput, Env, Persisters, ValidationError, WriteResponse } from '../../types';
import type { DataSaveResult, FunctionsSaveResult } from '@plitzi/sdk-shared';

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
  operations,
  look: z
    .enum(['html', 'image', 'accessibility', 'both'])
    .optional()
    .describe(
      'Also render the page: with dryRun, as the batch would leave it (nothing saved); without, as it was saved. ' +
        '"html" the markup, "image" a PNG, "accessibility" the outline a screen reader reads (text, far cheaper than ' +
        'an image), "both" image and outline. Check, look and then save with the same operations — written once.'
    ),
  pageRef,
  viewport,
  fullPage
};

export const NOTHING_CHANGED = 'Nothing changed: every operation left the space as it was.';

const noWarnings = (warnings: string[]): string[] | undefined => (warnings.length > 0 ? warnings : undefined);

/** Why the platform did not save the functions, as the batch's errors: each problem where it is, or the refusal. */
const functionsErrors = (saved: Exclude<FunctionsSaveResult, { ok: true }>, env: Env): ValidationError[] =>
  'problems' in saved
    ? saved.problems.map(problem => ({
        path: problem.file ? `functions/${problem.file}${problem.line ? `:${String(problem.line)}` : ''}` : 'functions',
        message: problem.message,
        hint: `Fix it with upsertFunctionFile; read ${functionFileUri(env, problem.file ?? 'index.ts')} for the file`
      }))
    : [
        {
          path: 'functions',
          message: saved.refusal.error,
          hint: `Read ${functionsUri(env)} again and redo the change on the current files`
        }
      ];

const dataErrors = (saved: Exclude<DataSaveResult, { ok: true }>, env: Env): ValidationError[] =>
  'problems' in saved
    ? saved.problems.map(problem => ({
        path: `data/${problem.file}`,
        message: problem.message,
        hint: `Fix it with upsertDataFile, or deleteDataFile; read ${dataFileUri(env, problem.file)} for the file`
      }))
    : [
        {
          path: 'data',
          message: saved.refusal.error,
          hint: `Read ${dataUri(env)} again and redo the change on the current files`
        }
      ];

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

  const { draft, outcome, suggestions } = result;
  // What the batch did, read off the space before and after it: what the answer reports, not what was asked.
  const effects = effectsOf(space, draft);
  const warnings = effects.length > 0 ? result.warnings : [NOTHING_CHANGED, ...result.warnings];

  // Dry run: everything is applied to the in-memory draft and reported (changed versions + full element detail),
  // but nothing is persisted — the agent inspects the outcome, then re-runs without dryRun to commit.
  if (input.dryRun) {
    return {
      applied: false,
      dryRun: true,
      summary: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted },
      effects,
      changed: changedResources(draft, env, outcome.staleResources),
      elements: resolvedElements(draft, env, outcome.elementRefs),
      warnings: noWarnings(warnings),
      suggestions: noWarnings(suggestions)
    };
  }

  // The functions first: they are built and checked as they are saved, so this is where a batch can still be refused —
  // and it has to be before anything else is written, or a refusal here would leave the rest of the batch saved.
  // Every store this batch had something for and no persister: said by name, never only as `persisted: false`.
  const unsaved: string[] = [];
  if (outcome.changedFunctions && draft.functions) {
    if (persisters?.saveFunctions) {
      const saved = await persisters.saveFunctions(draft.functions.files, space.functions?.version ?? '');
      if (!saved.ok) {
        return {
          applied: false,
          persisted: false,
          summary: { created: 0, updated: 0, deleted: 0 },
          changed: [],
          errors: functionsErrors(saved, env),
          warnings: noWarnings(warnings)
        };
      }
    } else {
      unsaved.push('the functions');
    }
  }

  // The data next, for the same reason: what it is checked for as it is saved (a path, the weight, a newer copy) can
  // still refuse the batch, before the documents are written.
  if (outcome.changedData && draft.data) {
    if (persisters?.saveData) {
      const saved = await persisters.saveData(draft.data.files, space.data?.version ?? '');
      if (!saved.ok) {
        return {
          applied: false,
          persisted: false,
          summary: { created: 0, updated: 0, deleted: 0 },
          changed: [],
          errors: dataErrors(saved, env),
          // Stores are saved one by one: the functions of this batch, saved just above, stay saved.
          warnings: noWarnings([
            ...(outcome.changedFunctions && persisters.saveFunctions
              ? ['The functions of this batch were saved; the data was not — apply the data again once fixed']
              : []),
            ...warnings
          ])
        };
      }
    } else {
      unsaved.push('the data');
    }
  }

  // Persist each schema that changed to its own store; unsaved when a changed schema has no persister.
  if (outcome.changedSchema) {
    if (persisters?.schema) {
      await persisters.schema(draft.schema);
    } else {
      unsaved.push('the schema');
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
      unsaved.push('the style');
    }
  }

  // Connectors are rows, not a document: only the ones this batch touched are written, and a delete is its own
  // call. A connector the batch created and then removed appears in neither list, so nothing is written for it.
  for (const id of outcome.changedConnectors) {
    const entry = draft.connectors.find(item => item.id === id);
    if (entry && persisters?.saveConnector) {
      await persisters.saveConnector(entry);
    } else {
      unsaved.push(`connector ${id}`);
    }
  }

  for (const id of outcome.deletedConnectors) {
    if (persisters?.deleteConnector) {
      await persisters.deleteConnector(id);
    } else {
      unsaved.push(`the removal of connector ${id}`);
    }
  }

  // Actions are rows too, and follow the connectors' rule exactly: only what this batch touched is written, a
  // delete is its own call, and one created and then removed in the same batch is written nowhere.
  for (const id of outcome.changedActions) {
    const entry = draft.actions.find(item => item.id === id);
    if (entry && persisters?.saveAction) {
      await persisters.saveAction(entry);
    } else {
      unsaved.push(`action ${id}`);
    }
  }

  for (const id of outcome.deletedActions) {
    if (persisters?.deleteAction) {
      await persisters.deleteAction(id);
    } else {
      unsaved.push(`the removal of action ${id}`);
    }
  }

  return {
    applied: true,
    persisted: unsaved.length === 0,
    summary: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted },
    effects,
    changed: changedResources(draft, env, outcome.staleResources),
    elements: resolvedElements(draft, env, outcome.elementRefs),
    warnings: noWarnings([
      ...(unsaved.length > 0 ? [`NOT saved: ${unsaved.join(', ')} — this server has no store to save it in`] : []),
      ...warnings
    ]),
    suggestions: noWarnings(suggestions)
  };
};

export const applyTool = defineTool({
  name: 'plitzi_apply',
  title: 'Apply',
  description:
    'Validate, apply and persist a batch of operations atomically. Returns `effects` (what it changed, read off the ' +
    'space), the changed resources’ new versions and each created or updated element’s detail. Pass dryRun to apply in memory only ' +
    '(inspect the outcome without committing), and `look` to see the page as the batch leaves it. Rejects the whole batch on any error or version conflict — INCLUDING ' +
    'a pre-existing malformation in any resource the batch touches (fix it in the same batch to unblock the save).',
  inputShape: applyShape,
  carriesOperations: true,
  access: 'write',
  run: async (input, ctx) => {
    // The same batch refused twice is not run a third time: the answer cannot change, and each attempt is paid for.
    const key = batchKey(`${String(ctx.spaceId ?? '')}:${ctx.env}`, input.operations);
    const before = timesRefused(key);
    if (before >= 2) {
      return REPEATED;
    }

    const result = await apply({ ...input, environment: ctx.env }, ctx.space, ctx.persisters);
    if (result.errors?.length) {
      noteRefused(key);

      return before === 1 ? { ...result, again: AGAIN } : result;
    }

    forgetRefused(key);
    if (!input.look || (!result.applied && !result.dryRun)) {
      return result;
    }

    const look = await lookAt(ctx, {
      pageRef: input.pageRef,
      operations: result.dryRun ? input.operations : undefined,
      view: input.look,
      viewport: input.viewport,
      fullPage: input.fullPage
    });
    if ('refused' in look) {
      return { ...result, look: look.refused };
    }

    return look.images.length > 0
      ? imageResult(look.images, { ...result, look: look.meta })
      : { ...result, look: look.meta };
  }
});
