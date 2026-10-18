import { isRecord } from '@plitzi/sdk-shared/helpers';
import { JOB_TYPE, jobTopic } from '@plitzi/sdk-shared/realtime';

import useChannel from './useChannel';

import type { FunctionJobView } from '@plitzi/sdk-shared';

const isJobView = (value: unknown): value is FunctionJobView =>
  isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.status === 'string';

/**
 * One of the space's jobs (`ctx.jobs.start` in its functions), live: its status, how far it is (`progress`, `step`),
 * and its `result` or `error` once it ends — as whoever the job lets watch it sees it, on `$job:<id>`. The latest is
 * there as the page joins, however late. `undefined` until it is heard — or when the job is not this visitor's to watch.
 */
const useJob = (id: string | undefined): FunctionJobView | undefined => {
  const { retained } = useChannel(id ? jobTopic(id) : undefined);
  const view = retained[JOB_TYPE];

  return isJobView(view) && view.id === id ? view : undefined;
};

export default useJob;
