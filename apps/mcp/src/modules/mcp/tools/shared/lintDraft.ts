import { elementSourceTypes, lintSpace } from '@plitzi/sdk-authoring';
import { validateSchema } from '@plitzi/sdk-schema/helpers/schemaValidator';
import { styleWithoutTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';

import { findElementByRef, findPageByRef } from '../../helpers';

import type { Space } from '../../helpers';
import type { ValidationError, ValidationResult } from '../../types';
import type { Operation } from '../operations';
import type { LintIssue } from '@plitzi/sdk-authoring';

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

/** One reading of a space: its structure — with the source catalogue, so a binding onto nothing is caught — and its meaning. */
const readingOf = (space: Space) => {
  const structure = validateSchema(space.schema, { sourceTypes: elementSourceTypes });
  const meaning = lintSpace(
    { schema: space.schema, style: space.style },
    // The deployment's own plugins are types too; without them every one of them reads as a typo.
    {
      pluginTypes: Object.entries(space.catalog ?? {})
        .filter(([, entry]) => entry.custom)
        .map(([type]) => type)
    }
  );

  return { structure, meaning };
};

const keyOf = (issue: LintIssue): string => JSON.stringify([issue.code, issue.elementId ?? '', issue.message]);

/**
 * The resulting space, read by the same checks every other door uses — `authorSpace`, the server's publish gate, the
 * builder's problems panel — and held to what this batch did.
 *
 * - A structural error the batch introduced blocks it wherever it landed: a delete can orphan an element the batch
 *   never named, and a broken tree is never left for later.
 * - Everything found in an element the batch touches blocks it, structural or not. One already there is labelled
 *   pre-existing, so the agent never takes it for its own change — and fixes it in the same batch.
 * - Elements the batch never touches are not held against it.
 */
export const lintDraft = (draft: Space, ops: Operation[], before?: Space): ValidationResult => {
  const touched = new Set(
    [...touchedRefs(ops)].flatMap(ref => {
      const element = findElementByRef(draft.schema, ref) ?? findPageByRef(draft.schema, ref);

      return element ? [element.id] : [];
    })
  );
  const earlier = before ? readingOf(before) : undefined;
  const previous = new Set(
    earlier ? [...earlier.structure.errors, ...earlier.meaning.errors, ...earlier.meaning.warnings].map(keyOf) : []
  );
  const { structure, meaning } = readingOf(draft);
  const onTouched = (issue: LintIssue): boolean => issue.elementId !== undefined && touched.has(issue.elementId);
  const preExisting = (issue: LintIssue): boolean => previous.has(keyOf(issue));

  const toError = (issue: LintIssue): ValidationError => ({
    path: issue.elementId ? `element "${issue.elementId}"` : 'schema',
    message: preExisting(issue)
      ? `Pre-existing malformation in element "${issue.elementId ?? ''}": ${issue.message}`
      : issue.message,
    hint: preExisting(issue)
      ? 'This issue already exists in the space (NOT caused by your change), but the save is blocked until you fix it too, in this same batch.'
      : ''
  });

  const errors = [
    ...structure.errors.filter(issue => onTouched(issue) || !preExisting(issue)),
    ...meaning.errors.filter(onTouched)
  ].map(toError);
  const warnings = [...structure.warnings, ...meaning.warnings]
    .filter(onTouched)
    .map(issue =>
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
