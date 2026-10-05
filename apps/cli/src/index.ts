import { Option, program } from 'commander';

import { SCHEMES } from './browser';
import { login, logout, space, whoami } from './commands/account';
import addPlugin from './commands/addPlugin';
import addRuntime from './commands/addRuntime';
import { check } from './commands/check';
import create from './commands/create';
import createPlugin from './commands/createPlugin';
import { dataDescribe } from './commands/data';
import { explainCommand } from './commands/explain';
import { fix } from './commands/fix';
import { devFunction, pullFunctions, pushFunctions, tryFunction } from './commands/functions';
import { importPage } from './commands/importPage';
import packPluginCommand from './commands/packPlugin';
import packSourceCommand from './commands/packSource';
import { pull } from './commands/pull';
import { push, PUSH_PARTS } from './commands/push';
import {
  powerRuntime,
  pushRuntime,
  runtimeStatus,
  setRuntimeSize,
  setRuntimeVariable,
  unsetRuntimeVariable
} from './commands/runtime';
import { shot } from './commands/shot';
import { upgrade, UPGRADE_PARTS } from './commands/upgrade';
import uploadPluginCommand from './commands/uploadPlugin';
import { positiveInteger, width, widths } from './options';
import { CREATE_TEMPLATES, PACKAGE_MANAGERS } from './scaffold';
import { CLI_VERSION } from './scaffold/project';

import type { AccountOptions, WhoamiOptions } from './commands/account';
import type { AddPluginOptions } from './commands/addPlugin';
import type { AddRuntimeOptions } from './commands/addRuntime';
import type { CheckOptions } from './commands/check';
import type { CreateOptions } from './commands/create';
import type { CreatePluginOptions } from './commands/createPlugin';
import type { DataDescribeOptions } from './commands/data';
import type { DryRunOptions } from './commands/dryRun';
import type { ExplainOptions } from './commands/explain';
import type { FixOptions } from './commands/fix';
import type { FunctionsDevOptions, FunctionsOptions } from './commands/functions';
import type { ImportOptions } from './commands/importPage';
import type { PackPluginOptions } from './commands/packPlugin';
import type { PackSourceOptions } from './commands/packSource';
import type { PullOptions } from './commands/pull';
import type { PushOptions } from './commands/push';
import type { RuntimeOptions, RuntimeStatusOptions } from './commands/runtime';
import type { ShotOptions } from './commands/shot';
import type { UpgradeOptions } from './commands/upgrade';
import type { UploadPluginOptions } from './commands/uploadPlugin';

/**
 * The command line for Plitzi.
 *
 * The gap it closes first is between installing the SDK and having a page on screen. Everything needed for that was
 * documented, which was the problem — a person had to read four things and write three files correctly before they
 * could tell whether any of it worked. The same holds for an element of one's own, which is the second thing it does.
 */

program.name('plitzi').description('Plitzi command line').version(CLI_VERSION);

/** A flag given more than once, as the list of every value. */
const collect = (value: string, previous: string[]): string[] => [...previous, value];

/** The flags that shape a PROJECT: given with `--plugin`, they are a mistake worth saying rather than ignoring. */
const PROJECT_ONLY = ['mode', 'source', 'key', 'template'] as const;

/** The widths a page is looked at, as one flag every command that opens a page shares. */
const widthsOption = (description: string, fallback: number[]): Option =>
  new Option('--width <px,px>', description).argParser(widths).default(fallback, fallback.join(','));

const schemeOption = (): Option =>
  new Option(
    '--scheme <scheme>',
    'The space’s theme, as a visitor’s toggle sets it. The space’s own default when left out'
  ).choices(SCHEMES);

/** What every command that writes or sends takes: say what it would do, and do none of it. */
const DRY_RUN_OPTION = [
  '--dry-run',
  'Say what it would do — files, installs, what it sends — and do none of it'
] as const;

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
  .addOption(
    new Option(
      '-t, --template <template>',
      'What a space written here starts as: welcome (a tour, the default), blank (tokens, a layout, one empty page) or catalog (a shop: layout, card component, data, filtered list, a page per product)'
    ).choices([...CREATE_TEMPLATES])
  )
  .option('--no-install', 'Write the files without installing dependencies')
  .option('-f, --force', 'Write into a directory that is not empty')
  .option(
    '-y, --yes',
    'At a terminal: take the defaults for any choice not passed. Without one, every choice must be passed'
  )
  .option(...DRY_RUN_OPTION)
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
  .option(...DRY_RUN_OPTION)
  .action((options: PullOptions) => pull(options));

program
  .command('push')
  .argument(
    '[parts...]',
    `Only these: ${PUSH_PARTS.join(', ')}. None named: what changed — ticked at a terminal, to choose from`
  )
  .description(
    'Put the project back on the space it works with, as its draft: the way back of pull. Refused when the draft changed since'
  )
  .option('-f, --force', 'Replace the space’s draft even when it changed since, or holds work this project never had')
  .option('--cdn <identifier>', 'Which of the space’s CDNs a plugin goes to, when it has several')
  .option('--bucket <identifier>', 'Which public bucket a plugin goes in, when there are several')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((parts: string[], options: PushOptions) => push(parts, options));

const add = program.command('add').description('Add something to the project you are in');

add
  .command('plugin')
  .argument('[names...]', 'What each element is called: seat-picker. Asked for when left out.')
  .description('Add elements of your own to this project: each one its component, declaration and builder panel')
  .option('-d, --dir <folder>', 'The folder that holds the project’s components. Asked for, unless the project says.')
  .option('--title <title>', 'One element only: what the builder calls it')
  .option('--description <description>', 'One element only: what it is for, in a sentence')
  .option(
    '--prop <name:type=default>',
    'One element only: an attribute it takes — interval:number=5000, paused:boolean, label:string=Hi. Repeat it',
    collect,
    []
  )
  .option('--trigger <name:fields>', 'An event it fires and what a flow reads — onTick:count. Repeat it', collect, [])
  .option('--callback <name>', 'An action a flow can call on it — reset. Repeat it', collect, [])
  .option('--headless', 'Nothing to see: hidden on a page, a badge in the builder (a clock, a listener)')
  .option(
    '--server',
    'With a server half: functions/ in its folder — routes under /fn/plugins/<type>/, steps <type>.<action>'
  )
  .option('-f, --force', 'Write into a folder that is not empty')
  .option(...DRY_RUN_OPTION)
  .action((names: string[], options: AddPluginOptions) => addPlugin(names, options));

add
  .command('runtime')
  .description(
    'The space’s runtime in src/runtime/: its own server code, run by this project’s server and by Plitzi (plitzi runtime push)'
  )
  .option('-f, --force', 'Write over a runtime the project already has')
  .option(...DRY_RUN_OPTION)
  .action((options: AddRuntimeOptions) => addRuntime(options));

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
  .option(...DRY_RUN_OPTION)
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
  .option(...DRY_RUN_OPTION)
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
  .option('--json', 'One object: { api, user, space }, for a tool or an agent')
  .option(...API_OPTION)
  .action((options: WhoamiOptions) => whoami(options));

program
  .command('space')
  .description('Choose the space to work in, in your browser. One at a time: it replaces the one chosen before')
  .option(...API_OPTION)
  .action((options: AccountOptions) => space(options));

program
  .command('check')
  .argument('[path]', 'The page: /about. The home page when left out')
  .description(
    'Whether a page of the running project is whole, in text: every element on screen, no broken image, no console error, no failed flow'
  )
  .addOption(widthsOption('The widths to check it at, separated by commas', [1440, 390]))
  .addOption(schemeOption())
  .option('--state', 'Also what the page holds: its state, and every source by name')
  .option('--element <id>', 'Also one element: what it reads, its own state, whether it is on screen')
  .option('--ssr', 'Also the HTML the server sent against the hydrated page: what a server provider sent late')
  .option('--json', 'One object per width, for a tool or an agent')
  .action((path: string | undefined, options: CheckOptions) => check(path, options));

program
  .command('fix')
  .description(
    'What authoring would fix in the space, as edits to your source: shown as a diff; with --write written, formatted and checked'
  )
  .option('--write', 'Write the edits — kept only when the space authors with each fix gone and no problem added')
  .option('--json', 'The plan as one object, for a tool or an agent')
  .action((options: FixOptions) => fix(options));

program
  .command('import')
  .argument('<url>', 'The page to start from: https://example.com/pricing')
  .description(
    'A page of a site you verified, as a place to start writing from: its tokens, the outline of its blocks per breakpoint, its lists as JSON — never its words'
  )
  .option('-o, --out <dir>', 'Where it is written, inside the project', 'src/imported')
  .addOption(
    widthsOption('The widths it is measured at: the widest is desktop, then tablet and mobile', [1440, 768, 390])
  )
  .option('-f, --force', 'Write over what --out already holds')
  .option(
    '--account',
    'A site not served from this machine: ask your Plitzi account whether one of your spaces verified its domain (signs in)'
  )
  .option('--json', 'One object, for a tool or an agent')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((url: string, options: ImportOptions) => importPage(url, options));

program
  .command('shot')
  .argument('[path]', 'The page: /about. The home page when left out')
  .description('A picture of one page of the running project — and, asked, how it differs from another or what moves')
  .addOption(new Option('--width <px>', 'The viewport width').argParser(width).default(1280))
  .addOption(
    new Option(
      '--height <px>',
      'The viewport height (the picture is the whole page unless --viewport, --scroll-to or --clip)'
    )
      .argParser(positiveInteger)
      .default(800)
  )
  .addOption(schemeOption())
  .option('-o, --out <file>', 'Where the picture goes. tmp/shots/<page>-<width>-<scheme>.png by default')
  .option('--compare <url>', 'Another site: the same page there, side by side, and how much differs by section')
  .addOption(
    new Option(
      '--frames <n>',
      'Pictures taken one after another: which sections move (a marquee, an autoplay)'
    ).argParser(positiveInteger)
  )
  .addOption(new Option('--every <ms>', 'How far apart --frames are taken').argParser(positiveInteger).default(500))
  .option('--wait-for <element>', 'An element to wait for first: its name (data-plitzi-el) or a CSS selector')
  .option('--clip <element>', 'Only this element — its name or a CSS selector — scrolled to wherever it is')
  .option('--scroll-to <element>', 'The page scrolled until this element is in view; the picture is the screen there')
  .option('--viewport', 'Only what fits the viewport, not the whole page')
  .option('--reduced-motion', 'As a visitor who asked for less motion')
  .option('--json', 'One object, for a tool or an agent')
  .action((path: string | undefined, options: ShotOptions) => shot(path, options));

program
  .command('explain')
  .argument(
    '[name]',
    'An element, a step, a trigger, a problem’s code, a transformer or a helper: container, navigate, class-and-css, bindTemplate, motion'
  )
  .description('What a name means when authoring a space — what it takes, fires, reads and how it is written')
  .option('--list <kind>', 'Every name of a kind: elements, steps, triggers, codes, transformers, helpers')
  .option('--json', 'One object, for a tool or an agent')
  .action((name: string | undefined, options: ExplainOptions) => explainCommand(name, options));

program
  .command('upgrade')
  .alias('update')
  .argument('[parts...]', `Only these: ${UPGRADE_PARTS.join(', ')} — every one when none is named`)
  .description(
    'Bring the project up to this CLI: its machinery files, package.json, the skills and renamed names — shown; with --write made'
  )
  .option(
    '--write',
    'Make the changes: files nobody changed replaced, package.json merged and installed, names renamed'
  )
  .option('--take <files...>', 'Replace these files of your own too (`all` for every one), after reading their diff')
  .option('--no-install', 'Write package.json and leave the install to you')
  .option('--json', 'One object, for a tool or an agent')
  .action((parts: string[], options: UpgradeOptions) => upgrade(parts, options));

const skills = program.command('skills').description('The Plitzi skills an agent reads in .claude/skills/');

skills
  .command('update')
  .description(
    'Bring them up to the Plitzi packages this project has installed, each replaced whole (`upgrade skills --write`)'
  )
  .option(...DRY_RUN_OPTION)
  .action((options: DryRunOptions) => upgrade(['skills'], { write: !options.dryRun }));

const data = program
  .command('data')
  .description('The JSON a project reads — src/data with a server, public/data without — without reading it whole');

data
  .command('describe')
  .argument('<file>', 'A JSON file: src/data/products.json')
  .description('Its shape — every field, its type, whether every row has it — and one row of its longest list')
  .option('--json', 'One object: { shape, example }')
  .action((file: string, options: DataDescribeOptions) => dataDescribe(file, options));

const upload = program.command('upload').description('Put something of this project on the space you work in');

upload
  .command('plugin')
  .argument('[zip]', 'The zip plitzi pack plugin built. Left out: the one packed in this project.')
  .description('Upload a packed plugin to a CDN of the space you work in, and install it there')
  .option('--cdn <identifier>', 'Which of the space’s CDNs the bucket is in.')
  .option('--bucket <identifier>', 'Which public bucket the plugin goes in. Asked for when there are several.')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((zip: string | undefined, options: UploadPluginOptions) => uploadPluginCommand(zip, options));

const functions = program
  .command('functions')
  .description('The space’s own server code: functions/ in this project is a working copy of it');

functions
  .command('pull')
  .description('Write the space’s functions into functions/ — refused when that would overwrite what is not pushed')
  .option('-f, --force', 'Overwrite what is not pushed, or a copy of another space')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((options: FunctionsOptions) => pullFunctions(options));

functions
  .command('push')
  .description('Save functions/ as the space’s draft: built and checked on the platform, refused if it moved on since')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
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
  .option('--entry <path>', 'The module whose default export is defineRuntime(…)', 'src/runtime/index.ts')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((options: RuntimeOptions) => pushRuntime(options));

runtime
  .command('status')
  .description('How each environment’s runtime is, and the names of its variables')
  .option('--json', 'One object: { space, environments, variables, sizes }, for a tool or an agent')
  .option(...API_OPTION)
  .action((options: RuntimeStatusOptions) => runtimeStatus(options));

for (const power of ['start', 'stop'] as const) {
  runtime
    .command(power)
    .description(
      power === 'start'
        ? 'Start an environment’s runtime again — one stopped for being unused, or by hand'
        : 'Stop an environment’s runtime, and keep it stopped until it is started'
    )
    .option('-e, --environment <name>', 'The environment: main (the draft) or a published one', 'main')
    .option(...API_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((options: RuntimeOptions & { environment?: string }) => powerRuntime(power, options));
}

runtime
  .command('size')
  .description('Choose the size an environment’s runtime runs at, among those the space’s plan includes')
  .argument('<size>', 'small, medium or large — plitzi runtime status says which the plan includes')
  .option('-e, --environment <name>', 'The environment: main (the draft) or a published one', 'main')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((size: string, options: RuntimeOptions & { environment?: string }) => setRuntimeSize(size, options));

const vars = runtime.command('vars').description('What the runtime starts with — written, never read back');

vars
  .command('set')
  .description('Give the runtime a variable, or a new value for one it has')
  .argument('<name>', 'The variable, in capitals: REDIS_URL')
  .argument('[value]', 'Its value — read from standard input when left out, which keeps it out of the shell history')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((name: string, value: string | undefined, options: RuntimeOptions) =>
    setRuntimeVariable(name, value, options)
  );

vars
  .command('unset')
  .description('Take a variable away from the runtime')
  .argument('<name>', 'The variable')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((name: string, options: RuntimeOptions) => unsetRuntimeVariable(name, options));

program.parse(process.argv);
