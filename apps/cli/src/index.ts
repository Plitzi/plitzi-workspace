import { InvalidArgumentError, Option, program } from 'commander';

import { SCHEMES } from './browser';
import { login, logout, space, whoami } from './commands/account';
import { activity } from './commands/activity';
import addPlugin from './commands/addPlugin';
import addRuntime from './commands/addRuntime';
import { move, remove } from './commands/arrange';
import { cert } from './commands/cert';
import { check } from './commands/check';
import create from './commands/create';
import createPlugin from './commands/createPlugin';
import { dataDescribe } from './commands/data';
import { edit } from './commands/edit';
import { explainCommand } from './commands/explain';
import { fix } from './commands/fix';
import { devFunction, pullFunctions, pushFunctions, tryFunction } from './commands/functions';
import { addFunctionsPackage } from './commands/functionsAdd';
import { importPage } from './commands/importPage';
import packPluginCommand from './commands/packPlugin';
import packSourceCommand from './commands/packSource';
import { pull } from './commands/pull';
import { push, PUSH_PARTS } from './commands/push';
import {
  runAbort,
  runAttach,
  runCanWrite,
  runContinue,
  runFinish,
  runOpen,
  runPlan,
  runRehearse,
  runPreview,
  runPrune,
  runReport,
  runPurge,
  runRelease,
  runResolve,
  runRestore,
  runResume,
  runShow,
  runState,
  runStatus,
  runStop,
  runWatch,
  spaceImpact,
  spaceOverview,
  taskAnswer,
  taskAsk,
  taskBlock,
  taskClaim,
  taskClaims,
  taskComplete,
  runNote,
  taskContextCommand,
  taskShow,
  taskTell,
  taskDiscard,
  taskInbox,
  taskMessage,
  taskNext,
  taskNote,
  taskProgress,
  taskPropose,
  taskProposals,
  taskReassign,
  taskRelease,
  taskRequest,
  taskReview,
  taskRevert,
  taskTake,
  taskUnblock,
  taskWait
} from './commands/runs';
import {
  powerRuntime,
  pushRuntime,
  runtimeStatus,
  setRuntimeSize,
  setRuntimeVariable,
  unsetRuntimeVariable
} from './commands/runtime';
import { shotEach, SHOT_MOMENTS } from './commands/shot';
import { elements } from './commands/spaceReading';
import { upgrade, UPGRADE_PARTS } from './commands/upgrade';
import uploadPluginCommand from './commands/uploadPlugin';
import { verify } from './commands/verify';
import { watchPass, watchSpace } from './commands/watch';
import { where, WHERE_READINGS } from './commands/where';
import { doctor } from './doctor';
import { feedback } from './feedback';
import { lint } from './lint';
import { count, duration, expectation, fill, fraction, positiveInteger, roleCounts, widths } from './options';
import { NEEDS } from './runs/model';
import { DEFAULT_AGENTS } from './runs/plan';
import { CREATE_TEMPLATES, PACKAGE_MANAGERS } from './scaffold';
import { FUNCTIONS_DIR } from './scaffold/paths';
import { CLI_VERSION } from './scaffold/project';

import type { AccountOptions, WhoamiOptions } from './commands/account';
import type { ActivityOptions } from './commands/activity';
import type { AddPluginOptions } from './commands/addPlugin';
import type { AddRuntimeOptions } from './commands/addRuntime';
import type { MoveOptions, RemoveOptions } from './commands/arrange';
import type { CertOptions } from './commands/cert';
import type { CheckOptions } from './commands/check';
import type { CreateOptions } from './commands/create';
import type { CreatePluginOptions } from './commands/createPlugin';
import type { DataDescribeOptions } from './commands/data';
import type { DryRunOptions } from './commands/dryRun';
import type { EditOptions } from './commands/edit';
import type { ExplainOptions } from './commands/explain';
import type { FixOptions } from './commands/fix';
import type { FunctionsDevOptions, FunctionsOptions } from './commands/functions';
import type { ImportOptions } from './commands/importPage';
import type { PackPluginOptions } from './commands/packPlugin';
import type { PackSourceOptions } from './commands/packSource';
import type { PullOptions } from './commands/pull';
import type { PushOptions } from './commands/push';
import type {
  AnswerOptions,
  FinishOptions,
  PlanOptions,
  ProposeOptions,
  ReviewOptions,
  RunCommandOptions,
  WatchRunOptions
} from './commands/runs';
import type { RuntimeOptions, RuntimeStatusOptions } from './commands/runtime';
import type { ShotOptions } from './commands/shot';
import type { UpgradeOptions } from './commands/upgrade';
import type { UploadPluginOptions } from './commands/uploadPlugin';
import type { VerifyOptions } from './commands/verify';
import type { WatchOptions } from './commands/watch';
import type { WhereOptions } from './commands/where';
import type { DoctorOptions } from './doctor';
import type { FeedbackOptions } from './feedback';
import type { LintOptions } from './lint';

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

/** Where `check` and `shot` find the project's pages when `npm start` here is not where they are. */
const URL_OPTION =
  'Where the project is served, when not by npm start here — a second server of it, staging, a deploy: https://host:port';

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

const spaceGroup = program
  .command('space')
  .description('The space this project works with: which one, its draft both ways, and how its source is written');

const pageGroup = program
  .command('page')
  .description(
    'A page of the running project: whether it is whole, a picture of it, or one of another site to start from'
  );

const elementGroup = program
  .command('element')
  .description('An element of the space written in this project: where its code is, and changing it there — checked');

const pluginGroup = program
  .command('plugin')
  .description('Elements of your own: added to the project, built into what the platform takes, and installed on it');

const runtime = program
  .command('runtime')
  .description('The space’s runtime: its own server code, run as a process of its own beside the platform');

const sourceGroup = program
  .command('source')
  .description('The source a plugin or the runtime is built from, kept beside what is sent');

spaceGroup
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

spaceGroup
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

pluginGroup
  .command('add')
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

runtime
  .command('add')
  .description(
    'Write the space’s runtime in src/runtime/: its own server code, run by this project’s server and by Plitzi (plitzi runtime push)'
  )
  .option('-f, --force', 'Write over a runtime the project already has')
  .option(...DRY_RUN_OPTION)
  .action((options: AddRuntimeOptions) => addRuntime(options));

pluginGroup
  .command('pack')
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

sourceGroup
  .command('pack')
  .argument('<entries...>', 'The files the build starts from: a runtime module, or each element’s index')
  .description('Write the source snapshot plitzi plugin upload and plitzi runtime push keep beside what they send')
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

spaceGroup
  .command('use')
  .description('Choose the space to work in, in your browser. One at a time: it replaces the one chosen before')
  .option(...API_OPTION)
  .action((options: AccountOptions) => space(options));

pageGroup
  .command('check')
  .argument('[paths...]', 'The pages: /about /writers, in one browser. The home page when left out')
  .description(
    'Whether a page of the running project is whole, in text: every element on screen, no broken image, no console error, no failed flow'
  )
  .addOption(widthsOption('The widths to check it at, separated by commas', [1440, 390]))
  .addOption(schemeOption())
  .option('--state', 'Also what the page holds: its state, and every source by name')
  .option(
    '--element <id>',
    'Also one element: what it reads, what it shows, its own state, whether it is on screen — one per check',
    (id: string, before?: string) => {
      // A second one would replace the first without a word: said instead.
      if (before !== undefined) {
        throw new InvalidArgumentError(`one --element per check: ${before} and ${id} are two checks`);
      }

      return id;
    }
  )
  .option('--ssr', 'Also the HTML the server sent against the hydrated page: what a server provider sent late')
  .option('--click <id>', 'Click one element once the page settles, and say what it changed — or that nothing did')
  .addOption(
    new Option(
      '--expect <id~text>',
      'The element shows this text (any case), as the page was left — or the check fails: once per element'
    ).argParser(expectation)
  )
  .addOption(
    new Option(
      '--fill <id=value>',
      'Fill a field as a visitor types in it — before the --click, or alone, saying what typing in it changed (a search box); once per field, a box takes true or false'
    ).argParser(fill)
  )
  .option(
    '--as <username>',
    'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env'
  )
  .option(
    '--presence',
    'Take part in the page’s realtime channels as a visitor does — arrive, announce, send. Otherwise it only watches them'
  )
  .option('--url <origin>', URL_OPTION)
  .option(
    '--space <module>',
    'Hold the pages to this space module instead of the project’s — what --url serves, an agent’s page — authored in a process of its own'
  )
  .option('--json', 'One object per page and width, for a tool or an agent')
  .action((paths: string[], options: CheckOptions) => check(paths, options));

spaceGroup
  .command('fix')
  .description(
    'What authoring would fix in the space, as edits to your source: shown as a diff; with --write written, formatted and checked'
  )
  .option('--write', 'Write the edits — kept only when the space authors with each fix gone and no problem added')
  .option('--json', 'The plan as one object, for a tool or an agent')
  .action((options: FixOptions) => fix(options));

pageGroup
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

pageGroup
  .command('shot')
  .argument('[path]', 'The page: /about. The home page when left out')
  .description('A picture of one page of the running project — and, asked, how it differs from another or what moves')
  .addOption(
    new Option('--width <px,px>', 'The viewport width — or several, separated by commas: a picture each')
      .argParser(widths)
      .default([1280], '1280')
  )
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
  .addOption(
    new Option(
      '--from <moment>',
      'When --frames start: once the page settles, or as soon as its HTML is in (load) — what plays as it arrives'
    )
      .choices([...SHOT_MOMENTS])
      .default('settled')
  )
  .option('--wait-for <element>', 'An element to wait for first: its name (data-plitzi-el) or a CSS selector')
  .option('--clip <element>', 'Only this element — its name or a CSS selector — scrolled to wherever it is')
  .option('--scroll-to <element>', 'The page scrolled until this element is in view; the picture is the screen there')
  .option('--viewport', 'Only what fits the viewport, not the whole page')
  .option(
    '--click <element...>',
    'Click these in order once the page settles — each its name or a CSS selector, inside a plugin too — picturing what each changed (--frames pictures --every ms apart after each)'
  )
  .addOption(
    new Option(
      '--fill <id=value>',
      'Type into a field first, as page check --fill does — before each --click, or alone, then pictured: once per field'
    ).argParser(fill)
  )
  .option('--sheet', 'Every picture taken — before, after each click, each frame — on one contact sheet')
  .option(
    '--steps <script>',
    'An interaction, step by step: "click <el>; type <el> <text>; press <key>; wait <ms>; wait-for <el>; shot [label]; frames <n> [ms]" — or @file with one per line'
  )
  .option('--reduced-motion', 'As a visitor who asked for less motion')
  .option(
    '--as <username>',
    'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env'
  )
  .option(
    '--presence',
    'Take part in the page’s realtime channels as a visitor does — arrive, announce, send. Otherwise it only watches them'
  )
  .option('--url <origin>', URL_OPTION)
  .option('--json', 'One object, for a tool or an agent')
  .action((path: string | undefined, options: Omit<ShotOptions, 'width'> & { width: number[] }) =>
    shotEach(path, options)
  );

program
  .command('verify')
  .description(
    'Whether the project is left passing: author, lints, types, its tests, format and every page, only the problems said'
  )
  .option('--no-pages', 'Leave the pages out — said as such')
  .option('--keep-going', 'Run every check even after one fails — by default the first failure ends the run')
  .option('--json', 'One object, for a tool or an agent')
  .action((options: VerifyOptions) => verify(options));

elementGroup
  .command('where')
  .argument('<query>', 'An element’s id, a class it wears, or words it shows: hero-cta, navLink, "Get started"')
  .description('Where the project’s code writes an element: the file, the line and the call itself')
  .addOption(
    new Option(
      '--by <reading>',
      'Read the query one way only, not the first of id, class and words that matches'
    ).choices(WHERE_READINGS)
  )
  .option('--json', 'One object, for a tool or an agent')
  .action((query: string, options: WhereOptions) => where(query, options));

elementGroup
  .command('edit')
  .argument('<id>', 'The element, by its id: hero-cta')
  .description('Change an element’s attributes in the call that writes it, then check the space still authors')
  .option('--set <key=value...>', 'An attribute to write: content="Start free", required=true')
  .option('--remove <key...>', 'An attribute to take out')
  .option('--every', 'The call writes other elements too, and the change is for every one')
  .option('--json', 'One object, for a tool or an agent')
  .action((id: string, options: EditOptions) => edit(id, options));

elementGroup
  .command('remove')
  .argument('<id>', 'The element, by its id: ent-trust')
  .description('Take an element out of the code that writes it, with what only it used, then check the space')
  .option('--json', 'One object, for a tool or an agent')
  .action((id: string, options: RemoveOptions) => remove(id, options));

elementGroup
  .command('move')
  .argument('<id>', 'The element, by its id: ent-faq')
  .description('Put an element before or after a sibling in the code that writes them, then check the space')
  .option('--before <id>', 'The sibling it goes before')
  .option('--after <id>', 'The sibling it goes after')
  .option('--json', 'One object, for a tool or an agent')
  .action((id: string, options: MoveOptions) => move(id, options));

// What `element edit`, `remove` and `move` read the space with in a fresh process, after they changed a file: not a
// command for a person.
elementGroup.command('readings', { hidden: true }).action(() => elements());

program
  .command('explain')
  .argument(
    '[name]',
    'An element, a step, a trigger, a problem’s code, a transformer or a helper: container, navigate, class-and-css, bindTemplate, motion'
  )
  .description('What a name means when authoring a space — what it takes, fires, reads and how it is written')
  .option('--list <kind>', 'Every name of a kind: elements, steps, triggers, codes, transformers, helpers, filters')
  .option('--json', 'One object, for a tool or an agent')
  .action((name: string | undefined, options: ExplainOptions) => explainCommand(name, options));

program
  .command('upgrade')
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
  .option('--with-open-runs', 'Upgrade although runs of agents are open: a person attaches to each after')
  .option('--json', 'One object, for a tool or an agent')
  .action((parts: string[], options: UpgradeOptions) => upgrade(parts, options));

program
  .command('doctor')
  .description(
    'Whether the project the CLI set up is whole — packages, its files, configs, what Node runs, plugins, data files, functions, records — each problem with its fix. Not the space: that is `npm run author`, and how it is written `plitzi space lint`'
  )
  .option(
    '--fix',
    'Repair what is simple and safe — a layout an older CLI left, dead files, .gitignore, a missing secret — then check again'
  )
  .option(...DRY_RUN_OPTION)
  .option('--strict', 'Warnings fail too (exit 1): for a CI that keeps the project up to its CLI')
  .option('--json', 'One object, for a tool or an agent')
  .action((options: DoctorOptions) => doctor(options));

program
  .command('cert')
  .description(
    'HTTPS while developing, for a phone or a tablet on your Wi-Fi: a certificate for this machine and its network addresses (mkcert), named in .env'
  )
  .option('--name <names...>', 'Other names this machine answers by, in the certificate too: studio.tailnet.ts.net')
  .option('--json', 'One object, for a tool or an agent')
  .action((options: CertOptions) => cert(options));

program
  .command('feedback')
  .description(
    'Start a report to Plitzi: writes the page in tmp/feedback/ with the versions and the project already in it, and tells the agent how to fill and publish it — to send as a link'
  )
  .option(
    '--previous <url>',
    'An earlier report this one continues — its numbering, and what changed. Repeat it',
    collect,
    []
  )
  .option('--json', 'One object: { file, facts, brief }, for a tool or an agent')
  .action((options: FeedbackOptions) => feedback(options));

spaceGroup
  .command('lint')
  .description(
    'How the space in src/space/ is written, eslint’s way: each practice to change at its file and line, what to write instead, and what authoring suggests. Not whether it authors — `npm run author` — nor the project: `plitzi doctor`'
  )
  .option('--strict', 'Warnings fail too (exit 1)')
  .addOption(new Option('--max-warnings <n>', 'More warnings than this fail (exit 1)').argParser(count))
  .option('--json', 'One object: { scope, notChecked, findings }, for a tool or an agent')
  .action((options: LintOptions) => lint(options));

spaceGroup
  .command('watch')
  .description(
    'The space read again on every save, and only what changed said: what the save did to it element by element, the problems it brought and fixed — or why it stopped authoring'
  )
  .option('--json', 'One event a line — ready, pass, refused — for an agent to run in the background')
  .action((options: WatchOptions) => watchSpace(options));

// What `space watch` reads each pass with, in a fresh process: not a command for a person.
spaceGroup.command('watch-pass', { hidden: true }).action(() => watchPass());

spaceGroup
  .command('activity')
  .description(
    'What happened on the space: the draft changed (a person in the builder, an agent, the autofix), a version went out, an action failed — your own pushes left out'
  )
  .option('-f, --follow', 'Stay, and say each as it happens: what an agent runs in the background to hear of them')
  .option('--after <cursor>', 'From where a previous read left off — the cursor it gave — not from the latest')
  .option('--mine', 'Keep your own pushes too')
  .addOption(new Option('--limit <n>', 'At most this many a page').argParser(positiveInteger))
  .option('--json', 'One page as one object — with --follow, one a line as it arrives — for a tool or an agent')
  .option(...API_OPTION)
  .action((options: ActivityOptions) => activity(options));

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

pluginGroup
  .command('upload')
  .argument('[zip]', 'The zip plitzi plugin pack built. Left out: the one packed in this project.')
  .description('Upload a packed plugin to a CDN of the space you work in, and install it there')
  .option('--cdn <identifier>', 'Which of the space’s CDNs the bucket is in.')
  .option('--bucket <identifier>', 'Which public bucket the plugin goes in. Asked for when there are several.')
  .option(...API_OPTION)
  .option(...DRY_RUN_OPTION)
  .action((zip: string | undefined, options: UploadPluginOptions) => uploadPluginCommand(zip, options));

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

// Several agents on one project (RFC 0028): each task in a copy of it, merged once, by a person.
const JSON_OPTION = ['--json', 'One object, for a tool or an agent'] as const;
const TOKEN_OPTION = ['--token <token>', 'The task’s token plitzi task take answered (or PLITZI_TASK_TOKEN)'] as const;
const RUN_OPTION = [
  '--run <run>',
  'The run, when the token does not say it and more than one is open (or PLITZI_RUN)'
] as const;
const AGENT_OPTION = ['--agent <name>', 'Who is calling, for the run’s log (or PLITZI_AGENT)'] as const;

const runGroup = program
  .command('run')
  .description(
    'Several agents on one project: a plan of tasks over disjoint files, each in a copy, merged once by a person'
  );

runGroup
  .command('plan')
  .description('Hold a plan the lead wrote to the rules — disjoint files, no cycles — expand it and estimate it')
  .argument(
    '<file>',
    'The plan, JSON: { version: 1, runId, goal, tasks: [{ id, title, files, dependsOn, priority, estimateMinutes, acceptance }] }'
  )
  .option(
    '--agents <n>',
    'How many agents may work at once — usually 2 to 5; above 5 a person confirms',
    positiveInteger,
    DEFAULT_AGENTS
  )
  .option(...JSON_OPTION)
  .action((file: string, options: PlanOptions) => runPlan(file, options));

runGroup
  .command('rehearse')
  .description(
    'Play a plan out before any agent starts: who works what when, the critical path, the lead’s reviews, the files several tasks change at once, and how many agents are worth it — nothing opened'
  )
  .argument('<file>', 'The plan, as plitzi run plan takes it')
  .option('--agents <n>', 'How many agents at once', positiveInteger, DEFAULT_AGENTS)
  .option('--roles <role=n,…>', 'Agents held to a role — designer=1,writer=2; the rest take any task', roleCounts)
  .option('--review <duration>', 'How long the lead takes over one review (90s, 8m)', duration, 5 * 60_000)
  .option(...JSON_OPTION)
  .action((file: string, options: PlanOptions & { roles?: Record<string, number>; review?: number }) =>
    runRehearse(file, options)
  );

runGroup
  .command('open')
  .description(
    'Open a run from a plan: its folder, every file it touches backed up — a person confirms above the threshold'
  )
  .argument('<file>', 'The plan')
  .option(
    '--agents <n>',
    'How many agents may work at once — usually 2 to 5; above 5 a person confirms',
    positiveInteger,
    DEFAULT_AGENTS
  )
  .option(...AGENT_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: PlanOptions) => runOpen(file, options));

runGroup
  .command('state')
  .description('Every run of the project, and where it stands')
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions) => runState(options));

runGroup
  .command('status')
  .description('A run at a glance: a line per task, then what needs attention')
  .argument('[run]', 'The run — the only open one when left out')
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: RunCommandOptions) => runStatus(run, options));

runGroup
  .command('note')
  .description(
    'Tell every task what holds for the whole run — a known issue, a decision: the ones in hand and those taken later'
  )
  .argument('<text>', 'The note — or - to read it from stdin')
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((text: string, options: RunCommandOptions) => runNote(text, options));

runGroup
  .command('watch')
  .description(
    'Follow a run: printed again whenever it changes, until it finishes — one JSON object a line with --json'
  )
  .argument('[run]', 'The run — the only open one when left out')
  .option('--interval <seconds>', 'How often to look (2; 10 with --until lead)', positiveInteger)
  .addOption(
    new Option(
      '--until <who>',
      'End the moment something new needs them — a review, a question, a block, a notice — each said once'
    ).choices(['lead'])
  )
  .option(
    '--timeout <duration>',
    'With --until: how long to wait before ending with nothing new (90s, 8m, 1h; a number is minutes)',
    duration,
    25 * 60_000
  )
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: WatchRunOptions) => runWatch(run, options));

runGroup
  .command('can-write')
  .description(
    'Whether a file may be written: no — with the task and until when — if a task of any open run holds it. For any hook'
  )
  .argument('<file>', 'The project file')
  .option('--task <task>', 'The task asking, when it has no token at hand')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions & { task?: string }) => runCanWrite(file, options));

runGroup
  .command('stop')
  .description(
    'Stop a run: the tasks in hand finish and go to review, none starts. --force is a person’s: it cuts them now'
  )
  .argument('[run]', 'The run')
  .option('--force', 'Now: tokens revoked, what was written since the last review discarded')
  .option(...AGENT_OPTION)
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: RunCommandOptions & { force?: boolean }) => runStop(run, options));

runGroup
  .command('resume')
  .description('Open a stopped run again')
  .argument('[run]', 'The run')
  .option(...AGENT_OPTION)
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: RunCommandOptions) => runResume(run, options));

runGroup
  .command('finish')
  .description(
    'The whole run into the project: a dry run with the checks on the result; --apply, a person’s, writes it'
  )
  .argument('[run]', 'The run')
  .option('--apply', 'Write it — a person, typing the run’s name')
  .option('--leave-pending', 'Finish without the tasks not done, said as such')
  .option(
    '--keep-backup',
    'Keep the project’s files as they were before the merge, in tmp/plitzi-backups/ — off by default'
  )
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: FinishOptions) => runFinish(run, options));

runGroup
  .command('preview')
  .description('The run’s work as it goes, served by the project’s dev server: each approval shows in it')
  .argument('[run]', 'The run')
  .option('--task <task>', 'A task in review instead: its copy as it went to review, to look at before approving it')
  .option('--port <port>', 'Where to serve it (8300; 8301 with --task)', positiveInteger)
  .action((run: string | undefined, options: RunCommandOptions & { port?: number; task?: string }) =>
    runPreview(run, options)
  );

runGroup
  .command('report')
  .description('How the run went, as the CLI saw it — and, with --summary, the lead’s summary that closes it')
  .argument('[run]', 'The run')
  .option('--summary <file>', 'The lead’s summary: what the run did, what went wrong, what is left (Markdown)')
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: RunCommandOptions & { summary?: string }) => runReport(run, options));

runGroup
  .command('resolve')
  .description('Settle one file of a reconciliation: the project’s version, the run’s, both merged, or a file of yours')
  .argument('<run>', 'The run')
  .argument('<file>', 'The file under reconciliation')
  .requiredOption(
    '--take <version>',
    'project, run, merge (both changes line by line, when they touch different lines), or the path of a file holding the version to keep'
  )
  .option(...JSON_OPTION)
  .action((run: string, file: string, options: RunCommandOptions & { take: string }) => runResolve(run, file, options));

runGroup
  .command('continue')
  .description('Every file resolved: the run goes on — a person’s')
  .argument('[run]', 'The run')
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: RunCommandOptions) => runContinue(run, options));

runGroup
  .command('abort')
  .description('End the run writing nothing into the project, and remove it with its agents’ work — a person’s')
  .argument('[run]', 'The run')
  .option(...JSON_OPTION)
  .action((run: string | undefined, options: RunCommandOptions) => runAbort(run, options));

runGroup
  .command('restore')
  .description('Put one project file back from a backup — a person’s')
  .argument('<run>', 'The run')
  .argument('<file>', 'The project file')
  .option('--from <backup>', 'base (when the run opened) or a merge (before it)', 'base')
  .option(...JSON_OPTION)
  .action((run: string, file: string, options: RunCommandOptions & { from?: string }) =>
    runRestore(run, file, options)
  );

runGroup
  .command('show')
  .description('A version of a file the run keeps: the run’s, the backup when it opened, or the project’s')
  .argument('<run>', 'The run')
  .argument('<file>', 'The project file')
  .addOption(new Option('--version <which>', 'Which one').choices(['run', 'base', 'project']).default('run'))
  .option(...JSON_OPTION)
  .action((run: string, file: string, options: RunCommandOptions & { version?: 'run' | 'base' | 'project' }) =>
    runShow(run, file, options)
  );

runGroup
  .command('attach')
  .description('Pick a run up: after the harness died, on another machine (--take-over, a person’s), after an upgrade')
  .argument('<run>', 'The run')
  .option('--take-over', 'Take it from the machine it is active on')
  .option(...AGENT_OPTION)
  .option(...JSON_OPTION)
  .action((run: string, options: RunCommandOptions & { takeOver?: boolean }) => runAttach(run, options));

runGroup
  .command('release')
  .description('Let a run go from this machine, so another can attach to it')
  .argument('<run>', 'The run')
  .option(...JSON_OPTION)
  .action((run: string, options: RunCommandOptions) => runRelease(run, options));

runGroup
  .command('purge')
  .description('Remove a run’s folder, backups included — a person’s')
  .argument('<run>', 'The run')
  .option(...JSON_OPTION)
  .action((run: string, options: RunCommandOptions) => runPurge(run, options));

runGroup
  .command('prune')
  .description('Remove the caches of a run idle for 8 hours — never its backups or its approved work')
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions) => runPrune(options));

const taskGroup = program
  .command('task')
  .description('A task of a run: taken, worked in its copy, completed, reviewed — and what it shares with the others');

taskGroup
  .command('next')
  .description('The ready task to take: highest priority, then the longest chain still to do')
  .option(
    '--role <roles>',
    'Only a task for these roles, separated by commas: developer, designer, reviewer, tester, writer…'
  )
  .option('--follow', 'Wait until one is ready — or every task of the role is done (finished: true)')
  .option('--timeout <duration>', 'With --follow: give up after this long, said (90s, 8m, 1h)', duration, 30 * 60_000)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions & { role?: string; follow?: boolean; timeout?: number }) => taskNext(options));

taskGroup
  .command('take')
  .description('Take a task: its files locked, its copy made, and its token answered')
  .argument('<task>', 'The task')
  .option('--role <role>', 'The role taking it: refused for another role’s task')
  .option(...RUN_OPTION)
  .option(...AGENT_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: RunCommandOptions & { role?: string }) => taskTake(task, options));

taskGroup
  .command('claims')
  .description('Which files each task locks, why and since when')
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions) => taskClaims(options));

taskGroup
  .command('claim')
  .description('Take a shared file by turns')
  .argument('<file>', 'The project file')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions) => taskClaim(file, options));

taskGroup
  .command('release')
  .description('Let a file held by turns go to the next task waiting for it')
  .argument('<file>', 'The project file')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions) => taskRelease(file, options));

taskGroup
  .command('wait')
  .description(
    'Wait for a file another task holds; it comes with the approved version. Exits 11, or with --follow stays until it is yours'
  )
  .argument('<file>', 'The project file')
  .option('--follow', 'Stay until the file is yours, giving the task’s sign of life meanwhile')
  .option(
    '--timeout <duration>',
    'With --follow: give up after this long, said, exit 11 (90s, 8m, 1h)',
    duration,
    30 * 60_000
  )
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions & { follow?: boolean; timeout?: number }) =>
    taskWait(file, options)
  );

taskGroup
  .command('discard')
  .description('Put a file of your copy back to the run’s version now, and start from it')
  .argument('<file>', 'The project file')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions) => taskDiscard(file, options));

taskGroup
  .command('progress')
  .description('Where the task is: its fraction and step — a heartbeat too')
  .option('--fraction <n>', 'Between 0 and 1', fraction)
  .option('--step <step>', 'What it is on: "page 3 of 5"')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions & { fraction?: number; step?: string }) => taskProgress(options));

taskGroup
  .command('heartbeat')
  .description('A sign of life, for a long think or test run with no write — at least every 2 minutes')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions) => taskProgress(options));

taskGroup
  .command('block')
  .description('Something outside the plan stops it — said, never waited on silently')
  .argument('[task]', 'The task — the token’s when left out')
  .requiredOption('--reason <reason>', 'What stops it: "an API key is missing"')
  .addOption(new Option('--needs <who>', 'Who unblocks it').choices(NEEDS).default('person'))
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string | undefined, options: RunCommandOptions & { reason: string; needs?: (typeof NEEDS)[number] }) =>
    taskBlock(task, options)
  );

taskGroup
  .command('unblock')
  .description('Lift a block — the lead’s or a person’s')
  .argument('<task>', 'The task')
  .option('--answer <text>', 'What it waited for, said to the task: it reaches its agent with its next command')
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: RunCommandOptions & { answer?: string }) => taskUnblock(task, options));

taskGroup
  .command('note')
  .alias('handoff')
  .description('What whoever comes next must know: a note, a handoff')
  .argument('<text>', 'The note')
  .option('--task <task>', 'The task — the token’s when left out')
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((text: string, options: RunCommandOptions & { task?: string }) => taskNote(options.task, text, options));

taskGroup
  .command('request')
  .description('Ask for a change in a shared file: change it in your copy too; one integration task applies them all')
  .argument('<file>', 'The shared file')
  .requiredOption('--summary <text>', 'The change and why: "a language tag on cards"')
  .option('--used-in <files>', 'Where you use it, comma-separated')
  .option('--blocking', 'It cannot wait: its integration task is made now, and this task waits for it')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions & { summary: string; usedIn?: string; blocking?: boolean }) =>
    taskRequest(file, options)
  );

taskGroup
  .command('propose')
  .description('Ask another task to agree to a change — to make it, or to accept it in its work; --wait for the answer')
  .argument('<task>', 'The task asked')
  .requiredOption('--change <change>', 'The change, specifically: "the card takes a `lang` prop"')
  .option('--about <file>', 'The file it is about')
  .option('--why <why>', 'Why this task needs it')
  .option('--wait', 'Wait for the answer; go on with what does not need it')
  .option('--follow', 'Stay until the answer comes, giving the task’s sign of life meanwhile')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: ProposeOptions) => taskPropose(task, options));

taskGroup
  .command('answer')
  .description('Answer a proposal made to your task — or, as the lead, to any: accept, reject or counter it')
  .argument('<proposal>', 'The proposal: t-home-p1')
  .option('--accept', 'Agree: both tasks carry it into review')
  .option('--reject <why>', 'Refuse it, saying why')
  .option('--counter <change>', 'Propose a change instead — three rounds at most, then the lead decides')
  .option('--note <note>', 'A note with an acceptance')
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((proposal: string, options: AnswerOptions) => taskAnswer(proposal, options));

taskGroup
  .command('proposals')
  .description('The proposals between tasks and their answers — your task’s, with its token')
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions) => taskProposals(options));

taskGroup
  .command('complete')
  .description('Finish the task: its copy compared by fingerprint, the project’s checks run in it, and to review')
  .option('--known-failure <why>', 'Go to review although the checks fail — for a reason that weighs, said to the lead')
  .option('--fixed-by <task>', 'With --known-failure: the task that fixes what fails')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions & { knownFailure?: string; fixedBy?: string }) => taskComplete(options));

taskGroup
  .command('tell')
  .description('Tell the lead what it should know — a finding, a choice you made, a risk — when no answer is needed')
  .argument('<text>', 'What to tell')
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((text: string, options: RunCommandOptions) => taskTell(text, options));

taskGroup
  .command('ask')
  .description('Ask the lead — stuck or unsure: the answer comes with your next command, or --follow for it')
  .argument('<text>', 'The question')
  .option('--follow', 'Stay until the lead answers, giving the task’s sign of life meanwhile')
  .option('--timeout <duration>', 'With --follow: give up after this long, said (90s, 8m, 1h)', duration, 30 * 60_000)
  .option(...TOKEN_OPTION)
  .option(...JSON_OPTION)
  .action((text: string, options: RunCommandOptions & { follow?: boolean; timeout?: number }) =>
    taskAsk(text, options)
  );

taskGroup
  .command('message')
  .description('The lead tells a task — or every task in hand, or an agent by name — what it needs to know')
  .argument('<task>', 'The task, all, or an agent as @name: it reaches it between tasks too (task next)')
  .argument('<text>', 'What to say')
  .option('--reply-to <message>', 'The question it answers: m3')
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, text: string, options: RunCommandOptions & { replyTo?: string }) =>
    taskMessage(task, text, options)
  );

taskGroup
  .command('inbox')
  .description('What was said to you and you have not read: a task’s with its token, the lead’s without')
  .option('--all', 'Every message to you and from you, read or not')
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions & { all?: boolean }) => taskInbox(options));

taskGroup
  .command('show')
  .description(
    'A task as its lead reviews it: acceptance, checks, agreements, notes, what was said, each file’s diff, and what to run next'
  )
  .argument('<task>', 'The task')
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: RunCommandOptions) => taskShow(task, options));

taskGroup
  .command('review')
  .description('The lead’s or a reviewer’s verdict: --approve merges it into the run’s work; --changes sends it back')
  .argument('<task>', 'The task in review')
  .option('--approve', 'Approve it')
  .option(
    '--overwrite',
    'With --approve, over a change someone made in the project while it worked: its version wins at the finish — said, the other kept'
  )
  .option(
    '--merge',
    'With --approve, with a change someone made in the project while it worked: both put together line by line, the checks run on the result'
  )
  .option('--changes <note>', 'What to change')
  .option('--on <element>', 'The element the change is about')
  .option('--file <file>', 'The file the change is about')
  .option(...RUN_OPTION)
  .option(...AGENT_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: ReviewOptions) => taskReview(task, options));

taskGroup
  .command('reassign')
  .description('Cut a task — its holder’s token revoked — for another to take from its last reviewed version')
  .argument('<task>', 'The task')
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: RunCommandOptions) => taskReassign(task, options));

taskGroup
  .command('revert')
  .description('Take an approved task’s work back out of the run’s, before the final merge — the others’ untouched')
  .argument('<task>', 'The task')
  .requiredOption('--reason <why>', 'Why: kept in its notes, and said to whoever takes it again')
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string, options: RunCommandOptions & { reason: string }) => taskRevert(task, options));

taskGroup
  .command('context')
  .description(
    'A task’s brief: what is asked, what holds for the whole run, what a review asked, what was agreed — --json for its files and diffs too'
  )
  .argument('[task]', 'The task — the token’s when left out')
  .option(...TOKEN_OPTION)
  .option(...RUN_OPTION)
  .option(...JSON_OPTION)
  .action((task: string | undefined, options: RunCommandOptions) => taskContextCommand(task, options));

/** What was piped in, read once: the text a `-` stands for. */
let piped: Promise<string> | undefined;
const readPiped = (): Promise<string> =>
  (piped ??= new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('"-" reads the text from stdin, and nothing is piped in: echo "…" | plitzi task ask -'));

      return;
    }

    let text = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => (text += chunk));
    process.stdin.on('end', () => resolve(text.replace(/\n$/, '')));
    process.stdin.on('error', reject);
  }));

// Every command of a run says who calls it, for the run's log: the same option everywhere. And one that names its run
// as an optional argument takes `--run` as well, as every task command does: an agent writes it one way.
for (const group of [runGroup, taskGroup]) {
  // A text written as `-` — a question, a note, a reason — is read from stdin: no quoting of a shell to get right.
  group.hook('preAction', async (_group, action) => {
    // An agent that reads every answer as JSON says so once, for its whole shell, not on each command.
    if (process.env.PLITZI_JSON === '1' && action.options.some(option => option.long === '--json')) {
      action.setOptionValue('json', true);
    }

    if (!action.processedArgs.includes('-') && !Object.values(action.opts()).includes('-')) {
      return;
    }

    const text = await readPiped();
    action.processedArgs = action.processedArgs.map((arg: unknown) => (arg === '-' ? text : arg));
    for (const [key, value] of Object.entries(action.opts())) {
      if (value === '-') {
        action.setOptionValue(key, text);
      }
    }
  });

  for (const command of group.commands) {
    if (!command.options.some(option => option.long === '--agent')) {
      command.option(...AGENT_OPTION);
    }

    const first = command.registeredArguments.at(0);
    if (first?.name() === 'run' && !first.required && !command.options.some(option => option.long === '--run')) {
      command.option(...RUN_OPTION);
    }
  }
}

spaceGroup
  .command('overview')
  .description(
    'Who owns which file, read off the imports: each page, layout, component and plugin, and what they share'
  )
  .option(...JSON_OPTION)
  .action((options: RunCommandOptions) => spaceOverview(options));

spaceGroup
  .command('impact')
  .description('What depends on a file, all the way back: the files that import it and the units it touches')
  .argument('<file>', 'The project file')
  .option(...JSON_OPTION)
  .action((file: string, options: RunCommandOptions) => spaceImpact(file, options));

// A command asked for at the top that is one of a group's — `plitzi push` — answered with where it is, not only that it
// is unknown: read off the commands themselves, so it says the truth of this CLI and nothing has to be kept in step.
program.on('command:*', (operands: string[]) => {
  const name = operands.at(0) ?? '';
  const homes = program.commands
    .filter(group => group.commands.some(command => command.name() === name))
    .map(group => `plitzi ${group.name()} ${name}`);
  program.error(
    homes.length > 0
      ? `There is no plitzi ${name}: it is ${homes.length === 1 ? homes[0] : `one of ${homes.join(', ')}`}. plitzi --help lists them all.`
      : `Unknown command ${name}. plitzi --help lists them all.`
  );
});

await program.parseAsync(process.argv);
