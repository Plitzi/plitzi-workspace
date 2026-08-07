// The connector domain: the space's server-side CMS/API clients. A third store beside the two schemas — one row
// per connector, addressed by the identifier a provider element stores — so it has its own ops and its own
// persister. The manifest vocabulary the ops share lives in manifest.ts.

import { deleteConnectorOp } from './deleteConnector';
import { patchConnectorOp } from './patchConnector';
import { upsertConnectorOp } from './upsertConnector';

export * from './upsertConnector';
export * from './patchConnector';
export * from './deleteConnector';

/** The connector write vocabulary, keyed by op type — feeds the discriminated union in tools/operations.ts. */
export const connectorOps = {
  upsertConnector: upsertConnectorOp,
  patchConnector: patchConnectorOp,
  deleteConnector: deleteConnectorOp
};
