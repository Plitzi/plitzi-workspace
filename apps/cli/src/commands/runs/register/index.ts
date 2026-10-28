import { sharedOptions } from './options';
import { registerRunGroup } from './run';
import { registerTaskGroup } from './task';

import type { Command } from 'commander';

/** The commands of several agents on one project — `plitzi run …` and `plitzi task …` — registered on the CLI's program. */
export const registerRuns = (program: Command): void => {
  sharedOptions([registerRunGroup(program), registerTaskGroup(program)]);
};
