import { deleteDefinitionOp } from './deleteDefinition';
import { deleteGlobalStyleOp } from './deleteGlobalStyle';
import { deleteStyleVariableOp } from './deleteStyleVariable';
import { patchDefinitionOp } from './patchDefinition';
import { patchGlobalStyleOp } from './patchGlobalStyle';
import { upsertDefinitionOp } from './upsertDefinition';
import { upsertGlobalStyleOp } from './upsertGlobalStyle';
import { upsertStyleVariableOp } from './upsertStyleVariable';

// The style-schema write vocabulary, keyed by op type — feeds the discriminated union in tools/operations.ts.
export const styleOps = {
  upsertDefinition: upsertDefinitionOp,
  patchDefinition: patchDefinitionOp,
  deleteDefinition: deleteDefinitionOp,
  upsertGlobalStyle: upsertGlobalStyleOp,
  patchGlobalStyle: patchGlobalStyleOp,
  deleteGlobalStyle: deleteGlobalStyleOp,
  upsertStyleVariable: upsertStyleVariableOp,
  deleteStyleVariable: deleteStyleVariableOp
};
