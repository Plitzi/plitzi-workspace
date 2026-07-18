import { deleteDefinitionOp } from './definitions/deleteDefinition';
import { patchDefinitionOp } from './definitions/patchDefinition';
import { upsertDefinitionOp } from './definitions/upsertDefinition';
import { deleteGlobalStyleOp } from './globalStyles/deleteGlobalStyle';
import { patchGlobalStyleOp } from './globalStyles/patchGlobalStyle';
import { upsertGlobalStyleOp } from './globalStyles/upsertGlobalStyle';
import { deleteIdStyleOp } from './idStyles/deleteIdStyle';
import { patchIdStyleOp } from './idStyles/patchIdStyle';
import { upsertIdStyleOp } from './idStyles/upsertIdStyle';
import { deleteStyleVariableOp } from './variables/deleteStyleVariable';
import { upsertStyleVariableOp } from './variables/upsertStyleVariable';

// The style-schema write vocabulary, keyed by op type — feeds the discriminated union in tools/operations.ts.
export const styleOps = {
  upsertDefinition: upsertDefinitionOp,
  patchDefinition: patchDefinitionOp,
  deleteDefinition: deleteDefinitionOp,
  upsertGlobalStyle: upsertGlobalStyleOp,
  patchGlobalStyle: patchGlobalStyleOp,
  deleteGlobalStyle: deleteGlobalStyleOp,
  upsertIdStyle: upsertIdStyleOp,
  patchIdStyle: patchIdStyleOp,
  deleteIdStyle: deleteIdStyleOp,
  upsertStyleVariable: upsertStyleVariableOp,
  deleteStyleVariable: deleteStyleVariableOp
};
