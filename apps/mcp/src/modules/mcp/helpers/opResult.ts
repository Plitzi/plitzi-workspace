import type { ValidationError } from '../types';
import type { RefusalCode } from '@plitzi/sdk-shared/refusals';

/** The result of one mutation handler: counts, the resource URIs it invalidated, any error, and the refs of
 *  elements it created/updated (so the caller can return their full detail as context — never for deletes). */
export interface OpResult {
  errors?: ValidationError[];
  created: number;
  updated: number;
  deleted: number;
  staleResources: string[];
  elementRefs?: string[];
}

export const empty = (): OpResult => ({ created: 0, updated: 0, deleted: 0, staleResources: [] });

/** A refusal of one operation: its code (`@plitzi/sdk-shared/refusals`), where, what was wrong, and the step that fixes it. */
export const fail = (
  code: RefusalCode,
  path: string,
  message: string,
  hint: string,
  validValues?: unknown[]
): OpResult => ({
  ...empty(),
  errors: [{ code, path, message, hint, validValues }]
});
