import { z } from 'zod';

import { dataFileUri, dataUri, empty, fail } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';

export const upsertDataFileOp = z
  .object({
    type: z.literal('upsertDataFile'),
    path: z.string().describe('e.g. "products.json" — read as query "/data/<path>"'),
    content: z.string().describe('The whole file, as JSON text')
  })
  .describe('Write one file of the space’s data (JSON its server providers read), whole.');

export const deleteDataFileOp = z
  .object({ type: z.literal('deleteDataFile'), path: z.string() })
  .describe('Remove one file of the space’s data.');

export type UpsertDataFile = z.infer<typeof upsertDataFileOp>;
export type DeleteDataFile = z.infer<typeof deleteDataFileOp>;

const unavailable = (): OpResult =>
  fail('type', 'This deployment keeps no space data', 'Read the data through a connector or a server action instead');

/**
 * The data is one store of files, saved whole: an op edits the draft's copy, and the batch saves the files it leaves —
 * checked by the platform then (each path, the weight), which answers by file. A file that is not JSON is refused here,
 * where it is written: it is what makes it data.
 */
export const upsertDataFile = (space: Space, env: Env, op: UpsertDataFile): OpResult => {
  if (!space.data) {
    return unavailable();
  }

  try {
    JSON.parse(op.content);
  } catch (error) {
    return fail(
      'content',
      `"${op.path}" is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      'Write the whole file as JSON text — an object or a list'
    );
  }

  const exists = Object.hasOwn(space.data.files, op.path);
  space.data.files = { ...space.data.files, [op.path]: op.content };

  return {
    ...empty(),
    ...(exists ? { updated: 1 } : { created: 1 }),
    staleResources: [dataUri(env), dataFileUri(env, op.path)]
  };
};

export const deleteDataFile = (space: Space, env: Env, op: DeleteDataFile): OpResult => {
  if (!space.data) {
    return unavailable();
  }

  if (!Object.hasOwn(space.data.files, op.path)) {
    return fail(
      'path',
      `The data has no file "${op.path}"`,
      `Read ${dataUri(env)} for the files it has`,
      Object.keys(space.data.files)
    );
  }

  const { [op.path]: _removed, ...files } = space.data.files;
  space.data.files = files;

  return { ...empty(), deleted: 1, staleResources: [dataUri(env), dataFileUri(env, op.path)] };
};

export const dataOps = { upsertDataFile: upsertDataFileOp, deleteDataFile: deleteDataFileOp };
