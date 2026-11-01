import { JSON_OPTION, RUN_OPTION, TOKEN_OPTION } from './options';
import { runAllow, runHold } from '../run/holds';

import type { RunCommandOptions } from '../shell';
import type { Command } from 'commander';

/** `plitzi run hold` and `plitzi run allow`: agents of the run stopped and held, and let start again — the lead's or a person's. */
export const registerHolds = (runGroup: Command): void => {
  runGroup
    .command('hold')
    .description(
      'Stop agents of the run and hold them — the lead’s or a person’s: their process ended, what they hold kept in their hands, never started again by the run until allowed'
    )
    .argument('[agents...]', 'The agents (dev-1, test-2) — every one of the team when none is named')
    .option(...RUN_OPTION)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((agents: string[], options: RunCommandOptions) => runHold(agents, options));

  runGroup
    .command('allow')
    .description(
      'Let agents the run holds start again — stopped by run hold, past their harness’s limit, or ending as they start (one more try)'
    )
    .argument('[agents...]', 'The agents — every one held when none is named')
    .option(...RUN_OPTION)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((agents: string[], options: RunCommandOptions) => runAllow(agents, options));
};
