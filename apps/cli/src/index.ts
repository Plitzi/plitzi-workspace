import { Option, program } from 'commander';

import { login, logout, space, whoami } from './commands/account';
import addPlugin from './commands/addPlugin';
import create from './commands/create';
import createPlugin from './commands/createPlugin';
import { devFunction, pullFunctions, pushFunctions, tryFunction } from './commands/functions';
import packPluginCommand from './commands/packPlugin';
import packSourceCommand from './commands/packSource';
import { pull } from './commands/pull';
import {
  powerRuntime,
  pushRuntime,
  runtimeStatus,
  setRuntimeSize,
  setRuntimeVariable,
  unsetRuntimeVariable
} from './commands/runtime';
import uploadPluginCommand from './commands/uploadPlugin';
import { PACKAGE_MANAGERS } from './scaffold';

import type { AccountOptions } from './commands/account';
import type { AddPluginOptions } from './commands/addPlugin';
import type { CreateOptions } from './commands/create';
import type { CreatePluginOptions } from './commands/createPlugin';
import type { FunctionsDevOptions, FunctionsOptions } from './commands/functions';
import type { PackPluginOptions } from './commands/packPlugin';
import type { PackSourceOptions } from './commands/packSource';
import type { PullOptions } from './commands/pull';
import type { RuntimeOptions } from './commands/runtime';
import type { UploadPluginOptions } from './commands/uploadPlugin';

/**
 * The command line for Plitzi.
 *
 * The gap it closes first is between installing the SDK and having a page on screen. Everything needed for that was
 * documented, which was the problem — a person had to read four things and write three files correctly before they
 * could tell whether any of it worked. The same holds for an element of one's own, which is the second thing it does.
 */

program.name('plitzi').description('Plitzi command line');

/** The flags that shape a PROJECT: given with `--plugin`, they are a mistake worth saying rather than ignoring. */
const PROJECT_ONLY = ['mode', 'source', 'key'] as const;

const API_OPTION = [
  '--api <url>',
  'The platform’s API. Defaults to PLITZI_API_URL, else the one signed in to, else https://api.plitzi.com.'
] as const;

program
  .command('create')
  .argument('[directory]', 'Where to write it. Defaults to the current directory, or asked for with --plugin.')
  .description('Scaffold a project that renders a Plitzi space, or with --plugin a plugin package')
  // No defaults written here: a choice left out is ASKED for (or, with nobody at the terminal, refused with the question
  // to put to the person), so it has to arrive as absent rather than already filled in. See `resolveDecisions`.
  .addOption(
    new Option('-m, --mode <mode>', 'server (SSR + RSC on a Node tier) or client (browser only)').choices([
      'server',
      'client'
    ])
  )
  .addOption(
    new Option(
      '-s, --source <source>',
      'local (the space travels in the project) or cloud (read it from Plitzi)'
    ).choices(['local', 'cloud'])
  )
  .option('-k, --key <key>', 'Cloud only: the space key (asked for when omitted)')
  .option(
    '-e, --environment <environment>',
    'Which version: main (the draft), or a published environment — what --from takes out, and what a cloud project serves',
    'main'
  )
  .option(
    '--revision <n>',
    'A published environment’s revision, pinned rather than its latest (with --from or --source cloud)'
  )
  .addOption(
    new Option(
      '-p, --package-manager <manager>',
      'The package manager the project is written for. Asked for when left out.'
    ).choices([...PACKAGE_MANAGERS])
  )
  .option(
    '--from <space>',
    'Make it from a space on Plitzi (its id or permanent URL): its pages, actions, functions, runtime, plugins and files, served by the project alone. Signs in as you; the space must be one you can change.'
  )
  .option(...API_OPTION)
  .option('--plugin', 'A plugin package instead: one element any space can load, with a preview and a build')
  .option('--name <name>', 'Plugin only: its package name (plitzi-plugin-seat-picker). Asked for when left out.')
  .option('--title <title>', 'Plugin only: what the builder calls the element')
  .option('--description <description>', 'Plugin only: what the element is for, in a sentence')
  .option('--owner <owner>', 'Plugin only: who publishes it')
  .option('--elements <names>', 'Plugin only: other elements the package holds, by name, separated by commas')
  .option('--no-install', 'Write the files without installing dependencies')
  .option('-f, --force', 'Write into a directory that is not empty')
  .option(
    '-y, --yes',
    'At a terminal: take the defaults for any choice not passed. Without one, every choice must be passed'
  )
  .action((directory: string | undefined, options: CreateOptions & CreatePluginOptions & { plugin?: boolean }) => {
    if (!options.plugin) {
      return create(directory, options);
    }

    const stray = PROJECT_ONLY.filter(flag => options[flag] !== undefined);
    if (stray.length > 0) {
      program.error(`--${stray.join(', --')} shape a project, not a plugin: leave them out with --plugin.`);
    }

    return createPlugin(directory, options);
  });

program
  .command('pull')
  .description(
    'Bring a project made with create --from up to date with its space: what changed there is written, what changed here is kept'
  )
  .option('-f, --force', 'Where a file changed both here and on the space, take the space’s copy')
  .option(
    '-e, --environment <environment>',
    'Follow another version from now on: main (the draft), or a published environment'
  )
  .option('--revision <n>', 'Pin a published revision of it, or latest to follow its newest again')
  .option(...API_OPTION)
  .action((options: PullOptions) => pull(options));

const add = program.command('add').description('Add something to the project you are in');

add
  .command('plugin')
  .argument('[names...]', 'What each element is called: seat-picker. Asked for when left out.')
  .description('Add elements of your own to this project: each one its component, declaration and builder panel')
  .option('-d, --dir <folder>', 'The folder that holds the project’s components. Asked for, unless the project says.')
  .option('--title <title>', 'One element only: what the builder calls it')
  .option('--description <description>', 'One element only: what it is for, in a sentence')
  .option('-f, --force', 'Write into a folder that is not empty')
  .action((names: string[], options: AddPluginOptions) => addPlugin(names, options));

const pack = program.command('pack').description('Build something of this project into what the platform takes');

pack
  .command('plugin')
  .argument('[folders...]', 'Element folders to pack, the main one first. In a plugin package, left out: all of them.')
  .description('Build a plugin: one ES module, its plugin-manifest.json, and the zip the builder takes under Resources')
  .option('-o, --out <folder>', 'Where the build goes. Emptied first; it must be inside the project.')
  .option('--no-zip', 'Build without the zip')
  .option('--plugin-version <version>', 'The version the manifest carries. Defaults to the one in package.json.')
  .option(
    '--source-root <folder>',
    'The project its source is kept relative to, when the elements are a project of their own inside this one'
  )
  .action((folders: string[], options: PackPluginOptions) => packPluginCommand(folders, options));

pack
  .command('source')
  .argument('<entries...>', 'The files the build starts from: a runtime module, or each element’s index')
  .description('Write the source snapshot plitzi upload and plitzi runtime push keep beside what they send')
  .addOption(
    new Option('--kind <kind>', 'What it is the source of').choices(['plugin', 'runtime']).makeOptionMandatory()
  )
  .requiredOption('--name <name>', 'The plugin’s type, or runtime')
  .option('--root <folder>', 'The project the paths are relative to. Defaults to the nearest package.json’s folder.')
  .requiredOption('-o, --out <file>', 'Where the gzipped snapshot goes')
  .action((entries: string[], options: PackSourceOptions) => packSourceCommand(entries, options));

program
  .command('login')
  .description('Sign in, in your browser. The session is kept and renewed until plitzi logout')
  .option(...API_OPTION)
  .action((options: AccountOptions) => login(options));

program
  .command('logout')
  .description('Sign out: the session is revoked on the platform and forgotten here')
  .action(() => logout());

program
  .command('whoami')
  .description('Who the CLI is signed in as, and the space it works in')
  .option(...API_OPTION)
  .action((options: AccountOptions) => whoami(options));

program
  .command('space')
  .description('Choose the space to work in, in your browser. One at a time: it replaces the one chosen before')
  .option(...API_OPTION)
  .action((options: AccountOptions) => space(options));

const upload = program.command('upload').description('Put something of this project on the space you work in');

upload
  .command('plugin')
  .argument('[zip]', 'The zip plitzi pack plugin built. Left out: the one packed in this project.')
  .description('Upload a packed plugin to a CDN of the space you work in, and install it there')
  .option('--cdn <identifier>', 'Which of the space’s CDNs the bucket is in.')
  .option('--bucket <identifier>', 'Which public bucket the plugin goes in. Asked for when there are several.')
  .option(...API_OPTION)
  .action((zip: string | undefined, options: UploadPluginOptions) => uploadPluginCommand(zip, options));

const functions = program
  .command('functions')
  .description('The space’s own server code: functions/ in this project is a working copy of it');

functions
  .command('pull')
  .description('Write the space’s functions into functions/ — refused when that would overwrite what is not pushed')
  .option('-f, --force', 'Overwrite what is not pushed, or a copy of another space')
  .option(...API_OPTION)
  .action((options: FunctionsOptions) => pullFunctions(options));

functions
  .command('push')
  .description('Save functions/ as the space’s draft: built and checked on the platform, refused if it moved on since')
  .option(...API_OPTION)
  .action((options: FunctionsOptions) => pushFunctions(options));

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
  .description('Run one task from functions/ on this machine, as the platform runs it — nothing reaches the space')
  .option('--params <json>', 'Its params, as a JSON object')
  .option('-w, --watch', 'Run it again every time a file of functions/ is saved')
  .action((task: string, options: FunctionsDevOptions) => devFunction(task, options));

const runtime = program
  .command('runtime')
  .description('The space’s runtime: its own server code, run as a process of its own beside the platform');

runtime
  .command('push')
  .description('Pack this project’s runtime module and keep it as the space’s draft runtime')
  .option('--entry <path>', 'The module whose default export is defineRuntime(…)', 'src/runtime.ts')
  .option(...API_OPTION)
  .action((options: RuntimeOptions) => pushRuntime(options));

runtime
  .command('status')
  .description('How each environment’s runtime is, and the names of its variables')
  .option(...API_OPTION)
  .action((options: RuntimeOptions) => runtimeStatus(options));

for (const power of ['start', 'stop'] as const) {
  runtime
    .command(power)
    .description(
      power === 'start'
        ? 'Start an environment’s runtime again — one stopped for being unused, or by hand'
        : 'Stop an environment’s runtime, and keep it stopped until it is started'
    )
    .option('--environment <name>', 'The environment: main (the draft) or a published one', 'main')
    .option(...API_OPTION)
    .action((options: RuntimeOptions & { environment?: string }) => powerRuntime(power, options));
}

runtime
  .command('size')
  .description('Choose the size an environment’s runtime runs at, among those the space’s plan includes')
  .argument('<size>', 'small, medium or large — plitzi runtime status says which the plan includes')
  .option('--environment <name>', 'The environment: main (the draft) or a published one', 'main')
  .option(...API_OPTION)
  .action((size: string, options: RuntimeOptions & { environment?: string }) => setRuntimeSize(size, options));

const vars = runtime.command('vars').description('What the runtime starts with — written, never read back');

vars
  .command('set')
  .argument('<name>', 'The variable, in capitals: REDIS_URL')
  .argument('[value]', 'Its value — read from standard input when left out, which keeps it out of the shell history')
  .option(...API_OPTION)
  .action((name: string, value: string | undefined, options: RuntimeOptions) =>
    setRuntimeVariable(name, value, options)
  );

vars
  .command('unset')
  .argument('<name>', 'The variable')
  .option(...API_OPTION)
  .action((name: string, options: RuntimeOptions) => unsetRuntimeVariable(name, options));

program.parse(process.argv);
