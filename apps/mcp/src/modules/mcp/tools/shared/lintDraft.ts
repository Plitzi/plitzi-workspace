import { elementSourceTypes, lintSpace } from '@plitzi/sdk-authoring';
import { validateSchema } from '@plitzi/sdk-schema/helpers/schemaValidator';
import { styleWithoutTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';

import { findElementByRef, findPageByRef } from '../../helpers';

import type { Space } from '../../helpers';
import type { ValidationResult } from '../../types';
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

const lintOf = (space: Space): { errors: LintIssue[]; warnings: LintIssue[] } => {
  // The source catalogue is what lets the structural pass tell a binding onto an element that does not exist from one
  // onto a type this document happens not to hold yet — without it, `apiContainer_ghost` passes for plausible.
  const structure = validateSchema(space.schema, { sourceTypes: elementSourceTypes });
  const lint = lintSpace(
    { schema: space.schema, style: space.style },
    // The deployment's own plugins are types too; without them every one of them reads as a typo.
    {
      pluginTypes: Object.entries(space.catalog ?? {})
        .filter(([, entry]) => entry.custom)
        .map(([type]) => type)
    }
  );

  return { errors: [...structure.errors, ...lint.errors], warnings: [...structure.warnings, ...lint.warnings] };
};

const key = (issue: LintIssue): string => `${issue.code} ${issue.elementId ?? ''} ${issue.message}`;

/**
 * The resulting space, read by the same linter every other door uses — the one `authorSpace`, the API and the builder
 * run — and held to what this batch touches.
 *
 * Every element the batch writes or edits must come out clean, so a malformation already living in a touched element
 * (a broken transformer, a source out of scope, a step with params its action does not take) blocks the save until
 * the same batch fixes it. Found in `before` too, a finding is labelled pre-existing so the agent never takes it for
 * its own change. Elements the batch never touches are not held against it.
 */
export const lintDraft = (draft: Space, ops: Operation[], before?: Space): ValidationResult => {
  const touched = new Set(
    [...touchedRefs(ops)].flatMap(ref => {
      const element = findElementByRef(draft.schema, ref) ?? findPageByRef(draft.schema, ref);

      return element ? [element.id] : [];
    })
  );
  const earlier = before ? lintOf(before) : undefined;
  const previous = new Set(earlier ? [...earlier.errors, ...earlier.warnings].map(key) : []);
  const { errors, warnings } = lintOf(draft);
  const inScope = (issue: LintIssue): boolean => issue.elementId !== undefined && touched.has(issue.elementId);
  const label = (issue: LintIssue): string =>
    previous.has(key(issue))
      ? `Pre-existing malformation in element "${issue.elementId ?? ''}": ${issue.message}`
      : issue.message;

  const result: ValidationResult = {
    valid: true,
    errors: errors.filter(inScope).map(issue => ({
      path: `element "${issue.elementId ?? ''}"`,
      message: label(issue),
      hint: previous.has(key(issue))
        ? 'This issue already exists in the space (NOT caused by your change), but the save is blocked until you fix it too, in this same batch.'
        : ''
    })),
    warnings: warnings.filter(inScope).map(label)
  };

  // Not a malformation: styling a provider that renders no element is what a batch does by accident, so it is said
  // about the element as it now stands.
  for (const id of touched) {
    const tagless = styleWithoutTag(draft.schema.flat[id], draft.style);
    if (tagless) {
      result.warnings.push(`element "${id}" ${tagless}`);
    }
  }

  result.valid = result.errors.length === 0;

  return result;
};
