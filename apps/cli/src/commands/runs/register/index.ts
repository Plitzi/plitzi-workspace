import { spaceImpact, spaceOverview } from '..';
import { JSON_OPTION, sharedOptions } from './options';
import { registerRunGroup } from './run';
import { registerTaskGroup } from './task';

import type { RunCommandOptions } from '..';
import type { Command } from 'commander';

/**
 * The commands of several agents on one project — `plitzi run …` and `plitzi task …`, and `space overview` /
 * `space impact`, which read who owns which file — registered on the CLI's program.
 */
export const registerRuns = (program: Command, spaceGroup: Command): void => {
  sharedOptions([registerRunGroup(program), registerTaskGroup(program)]);

  spaceGroup
    .command('overview')
    .description(
      'Who owns which file, read off the imports: each page, layout, component and plugin, and what they share'
    )
    .argument('[unit]', 'One unit whole — every file it owns and shares: src/space/pages/room.ts, src/plugins/Chat/')
    .option(...JSON_OPTION)
    .action((unit: string | undefined, options: RunCommandOptions) => spaceOverview(unit, options));

  spaceGroup
    .command('impact')
    .description('What depends on a file, all the way back: the files that import it and the units it touches')
    .argument('<file>', 'The project file')
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions) => spaceImpact(file, options));
};
