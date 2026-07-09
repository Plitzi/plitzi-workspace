import { isStyleOp } from './operations';
import { fail } from './opResult';
import * as schema from './schema/mutate';
import * as style from './style/mutate';

import type { OpResult } from './opResult';
import type { Space } from '../helpers';
import type { Env, ValidationError } from '../types';
import type { Operation } from './operations';

export type { OpResult } from './opResult';

const executeOp = (space: Space, env: Env, op: Operation): OpResult => {
  switch (op.type) {
    case 'upsertElement':
      return schema.upsertElement(space, env, op);
    case 'deleteElement':
      return schema.deleteElement(space, env, op);
    case 'moveElement':
      return schema.moveElement(space, env, op);
    case 'upsertPage':
      return schema.upsertPage(space, env, op);
    case 'deletePage':
      return schema.deletePage(space, env, op);
    case 'upsertVariable':
      return schema.upsertVariable(space, env, op);
    case 'deleteVariable':
      return schema.deleteVariable(space, env, op);
    case 'upsertDefinition':
      return style.upsertDefinition(space, env, op);
    case 'deleteDefinition':
      return style.deleteDefinition(space, env, op);
    case 'upsertStyleVariable':
      return style.upsertStyleVariable(space, env, op);
    case 'deleteStyleVariable':
      return style.deleteStyleVariable(space, env, op);
    default:
      return fail('type', `Unknown operation "${(op as { type: string }).type}"`, 'See the Operation union');
  }
};

export interface MutationOutcome {
  created: number;
  updated: number;
  deleted: number;
  staleResources: string[];
  errors: ValidationError[];
  changedSchema: boolean;
  changedStyle: boolean;
}

/** Apply operations in order to the space (mutating it). Records which schema(s) changed so the caller can
 *  persist each independently. Stops collecting counts for a failed op but records its errors. */
export const applyOperations = (space: Space, env: Env, ops: Operation[]): MutationOutcome => {
  const outcome: MutationOutcome = {
    created: 0,
    updated: 0,
    deleted: 0,
    staleResources: [],
    errors: [],
    changedSchema: false,
    changedStyle: false
  };
  const stale = new Set<string>();

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const result = executeOp(space, env, op);
    if (result.errors) {
      outcome.errors.push(...result.errors.map(e => ({ ...e, path: `operations[${i}].${e.path}` })));
      continue;
    }

    if (isStyleOp(op.type)) {
      outcome.changedStyle = true;
    } else {
      outcome.changedSchema = true;
    }

    outcome.created += result.created;
    outcome.updated += result.updated;
    outcome.deleted += result.deleted;
    for (const uri of result.staleResources) {
      stale.add(uri);
    }
  }

  outcome.staleResources = Array.from(stale);

  return outcome;
};
