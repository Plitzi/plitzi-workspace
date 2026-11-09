import { defineFunctions } from '@plitzi/sdk-runtime';

import type { FunctionsConfig } from '../config';
import type { FunctionTask } from '@plitzi/sdk-shared/functions';

/** A server's native functions made of just these tasks — what a test registers the tasks it runs with. */
export const tasksOf = (...tasks: FunctionTask<never>[]): FunctionsConfig => ({ native: [defineFunctions({ tasks })] });
