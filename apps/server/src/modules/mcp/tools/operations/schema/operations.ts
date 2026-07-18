import { deleteBindingOp } from './bindings/deleteBinding';
import { patchBindingOp } from './bindings/patchBinding';
import { upsertBindingOp } from './bindings/upsertBinding';
import { deleteElementOp } from './elements/deleteElement';
import { moveElementOp } from './elements/moveElement';
import { patchElementOp } from './elements/patchElement';
import { upsertElementOp } from './elements/upsertElement';
import { deleteFolderOp } from './folders/deleteFolder';
import { upsertFolderOp } from './folders/upsertFolder';
import { deleteInteractionOp } from './interactions/deleteInteraction';
import { patchInteractionNodeOp } from './interactions/patchInteractionNode';
import { upsertInteractionFlowOp } from './interactions/upsertInteractionFlow';
import { deletePageOp } from './pages/deletePage';
import { upsertPageOp } from './pages/upsertPage';
import { patchSettingsOp } from './settings/patchSettings';
import { deleteVariableOp } from './variables/deleteVariable';
import { upsertVariableOp } from './variables/upsertVariable';

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
  deleteInteraction: deleteInteractionOp,
  patchSettings: patchSettingsOp
};
