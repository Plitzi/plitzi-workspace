import { z } from 'zod';

import { empty, fail, functionFileUri, functionsUri } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';

export const upsertFunctionFileOp = z
  .object({
    type: z.literal('upsertFunctionFile'),
    path: z.string().describe('e.g. "index.ts", "lib/feed.ts"'),
    content: z.string().describe('The whole file')
  })
  .describe('Write one file of the space’s functions (its own server code), whole. See plitzi://guide.');

export const deleteFunctionFileOp = z
  .object({ type: z.literal('deleteFunctionFile'), path: z.string() })
  .describe('Remove one file of the space’s functions.');

export type UpsertFunctionFile = z.infer<typeof upsertFunctionFileOp>;
export type DeleteFunctionFile = z.infer<typeof deleteFunctionFileOp>;

const unavailable = (): OpResult =>
  fail('type', 'This deployment runs no space functions', 'Author the flow from the server tasks it offers instead');

/**
 * The functions are one store of files, saved whole: an op edits the draft's copy, and the batch saves the files it
 * leaves — built and checked by the platform then, which is where a problem in them is found and answered.
 */
export const upsertFunctionFile = (space: Space, env: Env, op: UpsertFunctionFile): OpResult => {
  if (!space.functions) {
    return unavailable();
  }

  const exists = Object.hasOwn(space.functions.files, op.path);
  space.functions.files = { ...space.functions.files, [op.path]: op.content };

  return {
    ...empty(),
    ...(exists ? { updated: 1 } : { created: 1 }),
    staleResources: [functionsUri(env), functionFileUri(env, op.path)]
  };
};

export const deleteFunctionFile = (space: Space, env: Env, op: DeleteFunctionFile): OpResult => {
  if (!space.functions) {
    return unavailable();
  }

  if (!Object.hasOwn(space.functions.files, op.path)) {
    return fail(
      'path',
      `The functions have no file "${op.path}"`,
      `Read ${functionsUri(env)} for the files they have`,
      Object.keys(space.functions.files)
    );
  }

  const { [op.path]: _removed, ...files } = space.functions.files;
  space.functions.files = files;

  return { ...empty(), deleted: 1, staleResources: [functionsUri(env), functionFileUri(env, op.path)] };
};

export const functionOps = { upsertFunctionFile: upsertFunctionFileOp, deleteFunctionFile: deleteFunctionFileOp };
