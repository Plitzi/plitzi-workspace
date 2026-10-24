import { FUNCTIONS_DIR } from '../../scaffold/paths';
import { devFunction, pullFunctions, pushFunctions, tryFunction } from '../functions';
import { addFunctionsPackage } from '../functionsAdd';
import { functionsLater } from '../functionsLater';
import { API_OPTION, DRY_RUN_OPTION } from './options';

import type { DryRunOptions } from '../dryRun';
import type { FunctionsDevOptions, FunctionsOptions } from '../functions';
import type { FunctionsLaterOptions } from '../functionsLater';
import type { Command } from 'commander';

/** `plitzi functions …`: the space's own server code, a working copy of it in this project. */
export const registerFunctions = (program: Command): void => {
  const functions = program
    .command('functions')
    .description(`The space’s own server code: ${FUNCTIONS_DIR}/ in this project is a working copy of it`);

  functions
    .command('pull')
    .description(
      `Write the space’s functions into ${FUNCTIONS_DIR}/ — refused when that would overwrite what is not pushed`
    )
    .option('-f, --force', 'Overwrite what is not pushed, or a copy of another space')
    .option(...API_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((options: FunctionsOptions) => pullFunctions(options));

  functions
    .command('push')
    .description(
      `Save ${FUNCTIONS_DIR}/ as the space’s draft: built and checked on the platform, refused if it moved on since`
    )
    .option(...API_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((options: FunctionsOptions) => pushFunctions(options));

  functions
    .command('add')
    .argument('<package>', 'An npm package the project installed — ical.js, @scope/name')
    .description(
      `Bundle a package into ${FUNCTIONS_DIR}/vendor/ for the functions to import, as a function carries its dependencies — web APIs only`
    )
    .option(...DRY_RUN_OPTION)
    .action((name: string, options: DryRunOptions) => addFunctionsPackage(name, options));

  functions
    .command('later')
    .argument('[key]', 'One run set for later, by the key ctx.later was given: show:<id>')
    .description(
      'What the served project holds to run later (ctx.later), each by its key and when it is due — and, --now, one started now'
    )
    .option('--now', 'Start it now, its input as it was set: what waits minutes is tried in a second')
    .option('--json', 'One object, for a tool or an agent')
    .action((key: string | undefined, options: FunctionsLaterOptions) => functionsLater(key, options));

  functions
    .command('try')
    .argument('<task>', 'The task, <namespace>.<action>')
    .description('Run one task of the draft in the sandbox: its value, what it logged, and why it failed')
    .option('--params <json>', 'Its params, as a JSON object')
    .option(...API_OPTION)
    .action((task: string, options: FunctionsOptions) => tryFunction(task, options));

  functions
    .command('dev')
    .argument('<task>', 'The task, <namespace>.<action>')
    .description(
      `Run one task from ${FUNCTIONS_DIR}/ on this machine, as the platform runs it — nothing reaches the space`
    )
    .option('--params <json>', 'Its params, as a JSON object')
    .option('-w, --watch', `Run it again every time a file of ${FUNCTIONS_DIR}/ is saved`)
    .action((task: string, options: FunctionsDevOptions) => devFunction(task, options));
};
