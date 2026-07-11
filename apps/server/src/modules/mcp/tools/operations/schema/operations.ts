import { deleteElementOp } from './deleteElement';
import { deleteFolderOp } from './deleteFolder';
import { deletePageOp } from './deletePage';
import { deleteVariableOp } from './deleteVariable';
import { moveElementOp } from './moveElement';
import { patchElementOp } from './patchElement';
import { upsertElementOp } from './upsertElement';
import { upsertFolderOp } from './upsertFolder';
import { upsertPageOp } from './upsertPage';
import { upsertVariableOp } from './upsertVariable';

// The element-schema write vocabulary, keyed by op type — feeds the discriminated union in tools/operations.ts.
export const elementOps = {
  upsertElement: upsertElementOp,
  patchElement: patchElementOp,
  deleteElement: deleteElementOp,
  moveElement: moveElementOp,
  upsertPage: upsertPageOp,
  deletePage: deletePageOp,
  upsertFolder: upsertFolderOp,
  deleteFolder: deleteFolderOp,
  upsertVariable: upsertVariableOp,
  deleteVariable: deleteVariableOp
};
