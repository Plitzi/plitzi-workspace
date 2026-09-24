import { elementSourceTypes, fixSpace, lintSpace } from '@plitzi/sdk-authoring';
import { validateSchema } from '@plitzi/sdk-schema/helpers/schemaValidator';
import { styleWithoutTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';

import { findElementByRef, findPageByRef } from '../../helpers';

import type { Space } from '../../helpers';
import type { ValidationError, ValidationResult } from '../../types';
import type { Operation } from '../operations';
import type { LintCatalogs, LintIssue } from '@plitzi/sdk-authoring';

/** The elements a batch touches, by the ref each op names — what the lint of the result is held to. */
const touchedRefs = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  for (const op of ops) {
    switch (op.type) {
      case 'upsertElement':
        refs.add(op.element.ref);
        break;
      case 'patchElement':
      case 'moveElement':
      case 'upsertBinding':
      case 'patchBinding':
      case 'deleteBinding':
      case 'upsertInteractionFlow':
      case 'patchInteractionNode':
      case 'deleteInteraction':
        refs.add(op.ref);
        break;
      default:
        break;
    }
  }

  return refs;
};

/** Those refs as the ids they name in `space` — a ref for an element the batch creates names nothing yet. */
const touchedIds = (space: Space, ops: Operation[]): Set<string> =>
  new Set(
    [...touchedRefs(ops)].flatMap(ref => {
      const element = findElementByRef(space.schema, ref) ?? findPageByRef(space.schema, ref);

      return element ? [element.id] : [];
    })
  );

/** The deployment's own plugins are types too; without them every one of them reads as a typo. */
const catalogsOf = (space: Space): LintCatalogs => ({
  pluginTypes: Object.entries(space.catalog ?? {})
    .filter(([, entry]) => entry.custom)
    .map(([type]) => type)
});

/**
 * The space as the batch should meet it: what was already wrong with the elements it is about to change, fixed where
 * the problem has one reading — a typo of an attribute, a URL left in page mode, a flag written as text.
 *
 * On the space BEFORE the batch, and only on the elements it touches. Fixing the result instead would "fix" the
 * batch's own mistakes — drop the attribute an agent just misspelt, and with it what it meant to say — where those
 * must be refused with the reason. Every fix is said in the answer, so nothing changes that the agent is not told of.
 * What has no single reading is left, and still blocks the batch as pre-existing.
 */
export const fixTouched = (space: Space, ops: Operation[]): { space: Space; fixed: string[] } => {
  const ids = touchedIds(space, ops);
  if (ids.size === 0) {
    return { space, fixed: [] };
  }

  const { schema, applied } = fixSpace({ schema: space.schema, style: space.style }, catalogsOf(space), undefined, ids);
  if (applied.length === 0) {
    return { space, fixed: [] };
  }

  return {
    space: { ...space, schema },
    fixed: applied.map(
      fix => `Fixed a pre-existing problem in element "${fix.elementId ?? ''}" while changing it: ${fix.message}`
    )
  };
};

/** One reading of a space: its structure — with the source catalogue, so a binding onto nothing is caught — and its meaning. */
const readingOf = (space: Space) => {
  const structure = validateSchema(space.schema, { sourceTypes: elementSourceTypes });
  const meaning = lintSpace({ schema: space.schema, style: space.style }, catalogsOf(space));

  return { structure, meaning, all: [...structure.errors, ...meaning.errors, ...meaning.warnings] };
};

const keyOf = (issue: LintIssue): string => JSON.stringify([issue.code, issue.elementId ?? '', issue.message]);
const kindOf = (issue: LintIssue): string => JSON.stringify([issue.code, issue.elementId ?? '']);

const countByKind = (issues: LintIssue[]): Map<string, number> => {
  const counts = new Map<string, number>();
  issues.forEach(issue => counts.set(kindOf(issue), (counts.get(kindOf(issue)) ?? 0) + 1));

  return counts;
};

/**
 * Which of the draft's issues the space already had.
 *
 * The same message is the same issue. But a message also says where the element is and what it might have meant — a
 * page renamed, a closer name added to the space — so it can change while the issue does not. A kind of issue on an
 * element (its code there) the draft has no more of than the space had is the same issue in other words; one more of
 * it than before is the batch's.
 */
const preExistingIn = (before: LintIssue[], draft: LintIssue[]): ((issue: LintIssue) => boolean) => {
  const messages = new Set(before.map(keyOf));
  const had = countByKind(before);
  const has = countByKind(draft);

  return issue => messages.has(keyOf(issue)) || (has.get(kindOf(issue)) ?? 0) <= (had.get(kindOf(issue)) ?? 0);
};

/**
 * The resulting space, read by the same checks every other door uses — `authorSpace`, the server's publish gate, the
 * builder's problems panel — and held to what this batch did.
 *
 * - A structural error the batch introduced blocks it wherever it landed: a delete can orphan an element the batch
 *   never named, and a broken tree is never left for later.
 * - Everything found in an element the batch touches blocks it, structural or not. One already there is labelled
 *   pre-existing, so the agent never takes it for its own change — and fixes it in the same batch.
 * - Elements the batch never touches are not held against it.
 *
 * The space as it was is read only when the draft has something to say about: telling an old issue from a new one is
 * the one thing that reading is for, and most batches leave nothing to tell.
 */
export const lintDraft = (draft: Space, ops: Operation[], before?: Space): ValidationResult => {
  const touched = touchedIds(draft, ops);
  const { structure, meaning, all } = readingOf(draft);
  const onTouched = (issue: LintIssue): boolean => issue.elementId !== undefined && touched.has(issue.elementId);

  const candidates = [...structure.errors, ...meaning.errors.filter(onTouched)];
  const touchedWarnings = [...structure.warnings, ...meaning.warnings].filter(onTouched);
  const preExisting =
    before && (candidates.length > 0 || touchedWarnings.length > 0)
      ? preExistingIn(readingOf(before).all, all)
      : () => false;

  const toError = (issue: LintIssue): ValidationError => ({
    path: issue.elementId ? `element "${issue.elementId}"` : 'schema',
    message: preExisting(issue)
      ? `Pre-existing malformation in element "${issue.elementId ?? ''}": ${issue.message}`
      : issue.message,
    hint: preExisting(issue)
      ? 'This issue already exists in the space (NOT caused by your change), but the save is blocked until you fix it too, in this same batch.'
      : ''
  });

  const errors = candidates.filter(issue => onTouched(issue) || !preExisting(issue)).map(toError);
  const warnings = touchedWarnings.map(issue =>
    preExisting(issue) ? `Pre-existing issue in element "${issue.elementId ?? ''}": ${issue.message}` : issue.message
  );

  // Not a malformation: styling a provider that renders no element is what a batch does by accident, so it is said
  // about the element as it now stands.
  for (const id of touched) {
    const tagless = styleWithoutTag(draft.schema.flat[id], draft.style);
    if (tagless) {
      warnings.push(`element "${id}" ${tagless}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
};
