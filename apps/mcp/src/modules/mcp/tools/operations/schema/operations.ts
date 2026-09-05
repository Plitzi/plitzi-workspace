import { deleteBindingOp } from './bindings/deleteBinding';
import { patchBindingOp } from './bindings/patchBinding';
import { upsertBindingOp } from './bindings/upsertBinding';
import { deleteElementOp } from './elements/deleteElement';
import { moveElementOp } from './elements/moveElement';
import { patchElementOp } from './elements/patchElement';
import { repeatElementOp } from './elements/repeatElement';
import { upsertElementOp } from './elements/upsertElement';
import { deleteFolderOp } from './folders/deleteFolder';
import { upsertFolderOp } from './folders/upsertFolder';
import { deleteInteractionOp } from './interactions/deleteInteraction';
import { patchInteractionNodeOp } from './interactions/patchInteractionNode';
import { upsertInteractionFlowOp } from './interactions/upsertInteractionFlow';
import { deleteLayoutOp } from './pages/deleteLayout';
import { deletePageOp } from './pages/deletePage';
import { upsertLayoutOp } from './pages/upsertLayout';
import { upsertPageOp } from './pages/upsertPage';
import { patchSettingsOp } from './settings/patchSettings';
import { deleteVariableOp } from './variables/deleteVariable';
import { upsertVariableOp } from './variables/upsertVariable';

// The element-schema write vocabulary, keyed by op type — feeds the discriminated union in tools/operations.ts.
export const elementOps = {
  upsertElement: upsertElementOp,
  repeatElement: repeatElementOp,
  patchElement: patchElementOp,
  deleteElement: deleteElementOp,
  moveElement: moveElementOp,
  upsertPage: upsertPageOp,
  deletePage: deletePageOp,
  upsertLayout: upsertLayoutOp,
  deleteLayout: deleteLayoutOp,
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
