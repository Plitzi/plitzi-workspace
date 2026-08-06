import { expandRepeat } from '../operations/schema/elements/repeatElement';

import type { ValidationError } from '../../types';
import type { Operation } from '../operations';

/** Rewrites the sugar ops into the vocabulary the rest of the pipeline knows, BEFORE validation — today that is
 *  `repeatElement`, which stands for the `upsertElement` its template + rows expand to. Everything downstream
 *  (validator, dispatch, audit, versions) therefore stays unaware of it, and a row that renders a bad element is
 *  reported by the ordinary element checks.
 *
 *  One op in, one op out: the indices the agent sent are the indices every error path names, so `operations[3]`
 *  still means the fourth operation it wrote. */
export const expandOperations = (ops: Operation[]): { operations: Operation[]; errors: ValidationError[] } => {
  if (!ops.some(op => op.type === 'repeatElement')) {
    return { operations: ops, errors: [] };
  }

  const operations: Operation[] = [];
  const errors: ValidationError[] = [];

  for (const [index, op] of ops.entries()) {
    if (op.type !== 'repeatElement') {
      operations.push(op);
      continue;
    }

    const expanded = expandRepeat(op);
    if (!expanded.element) {
      errors.push(...expanded.errors.map(error => ({ ...error, path: `operations[${index}].${error.path}` })));
      continue;
    }

    operations.push({
      type: 'upsertElement',
      pageRef: op.pageRef,
      element: expanded.element,
      ...(op.parentRef === undefined ? {} : { parentRef: op.parentRef }),
      ...(op.position === undefined ? {} : { position: op.position })
    });
  }

  return { operations, errors };
};
