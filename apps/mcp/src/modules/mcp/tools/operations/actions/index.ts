// The action domain: the space's server-side flows. A fourth store beside the two schemas and the connectors —
// one row per action, addressed by the identifier a `runServerAction` step stores — so it has its own ops and its
// own persister. The document vocabulary the ops share lives in document.ts.

import { deleteActionOp } from './deleteAction';
import { patchActionOp } from './patchAction';
import { upsertActionOp } from './upsertAction';

export * from './upsertAction';
export * from './patchAction';
export * from './deleteAction';

/** The action write vocabulary, keyed by op type — feeds the discriminated union in tools/operations.ts. */
export const actionOps = {
  upsertAction: upsertActionOp,
  patchAction: patchActionOp,
  deleteAction: deleteActionOp
};
