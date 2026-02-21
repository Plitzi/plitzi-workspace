import { ApolloLink, Observable } from '@apollo/client/core';

import type { FormattedExecutionResult } from 'graphql';

type WithoutTypename<T> =
  T extends Array<infer U>
    ? Array<WithoutTypename<U>>
    : T extends object
      ? { [K in keyof T as K extends '__typename' ? never : K]: WithoutTypename<T[K]> }
      : T;

/**
 * Recursively removes __typename from objects and arrays.
 * Optimized to avoid creating new objects/arrays if not needed.
 */
export function stripTypenameDeep<T>(value: T): WithoutTypename<T> {
  if (Array.isArray(value)) {
    let changed: boolean = false;
    const result = value.map(v => {
      const stripped = stripTypenameDeep(v) as WithoutTypename<T>;
      if (stripped !== v) {
        changed = true;
      }

      return stripped;
    });

    return (changed as boolean) ? (result as WithoutTypename<T>) : (value as WithoutTypename<T>);
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    let changed = false;
    for (const key in value as Record<string, unknown>) {
      if (key === '__typename') {
        changed = true;
        continue;
      }
      const val = (value as Record<string, unknown>)[key];
      const stripped = stripTypenameDeep(val);
      if (stripped !== val) {
        changed = true;
      }

      result[key] = stripped;
    }
    return changed ? (result as WithoutTypename<T>) : (value as WithoutTypename<T>);
  }

  return value as WithoutTypename<T>;
}

type ApolloFormattedResult = FormattedExecutionResult<Record<string, unknown>, Record<string, unknown>>;

/**
 * ApolloLink that strips __typename from the result data.
 * Uses optimized stripTypenameDeep.
 */
export const createStripTypenameLink = () =>
  new ApolloLink((operation, forward) => {
    return new Observable<ApolloFormattedResult>(observer => {
      const subscription = forward(operation).subscribe({
        next: result => {
          observer.next(result.data ? { ...result, data: stripTypenameDeep(result.data) } : result);
        },
        error: error => observer.error(error),
        complete: () => observer.complete()
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  });
