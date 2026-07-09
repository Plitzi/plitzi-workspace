import type { ValidationError } from '../types';

/** The result of one mutation handler: counts, the resource URIs it invalidated, and any error. */
export interface OpResult {
  errors?: ValidationError[];
  created: number;
  updated: number;
  deleted: number;
  staleResources: string[];
}

export const empty = (): OpResult => ({ created: 0, updated: 0, deleted: 0, staleResources: [] });

export const fail = (path: string, message: string, hint: string, validValues?: unknown[]): OpResult => ({
  ...empty(),
  errors: [{ path, message, hint, validValues }]
});
