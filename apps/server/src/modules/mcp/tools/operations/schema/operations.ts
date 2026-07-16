import { deleteBindingOp } from './deleteBinding';
import { deleteElementOp } from './deleteElement';
import { deleteFolderOp } from './deleteFolder';
import { deleteInteractionOp } from './deleteInteraction';
import { deletePageOp } from './deletePage';
import { deleteVariableOp } from './deleteVariable';
import { moveElementOp } from './moveElement';
import { patchBindingOp } from './patchBinding';
import { patchElementOp } from './patchElement';
import { patchInteractionNodeOp } from './patchInteractionNode';
import { upsertBindingOp } from './upsertBinding';
import { upsertElementOp } from './upsertElement';
import { upsertFolderOp } from './upsertFolder';
import { upsertInteractionFlowOp } from './upsertInteractionFlow';
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
  deleteVariable: deleteVariableOp,
  upsertBinding: upsertBindingOp,
  patchBinding: patchBindingOp,
  deleteBinding: deleteBindingOp,
  upsertInteractionFlow: upsertInteractionFlowOp,
  patchInteractionNode: patchInteractionNodeOp,
  deleteInteraction: deleteInteractionOp
};
