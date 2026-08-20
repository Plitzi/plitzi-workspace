import type { ActionsModule } from '../index';
import type { SSRResponseHelpers } from '@plitzi/sdk-shared';

export type ActionCancelDeps = {
  res: SSRResponseHelpers;
  module: ActionsModule;
  runId: string;
  callerId: string;
};

/**
 * Stops a run in flight.
 *
 * The socket closing already aborts a run, so this exists for the cases it cannot cover: a mobile client whose
 * peer is gone without the server seeing it for minutes, and a run started in one tab that the visitor wants to
 * stop from another. Ownership is checked in the guards — a run id travels to the browser, and holding one must
 * not let anybody stop somebody else's run.
 *
 * A run that is not there, or is not the caller's, answers 404 either way: distinguishing them would turn this
 * into an oracle for which run ids are live.
 */
export const handleActionCancel = ({ res, module, runId, callerId }: ActionCancelDeps): void => {
  const cancelled = module.guards.cancel(runId, callerId);
  res.setStatus(cancelled ? 204 : 404);
  res.setHeader('Cache-Control', 'no-store');
  res.send('');
};
