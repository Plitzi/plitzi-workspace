import { Command, Option } from 'commander';

import { commandHint } from './commandHints';
import { login, logout, space, whoami } from './commands/account/account';
import addPlugin from './commands/plugin/addPlugin';
import packPluginCommand from './commands/plugin/packPlugin';
import uploadPluginCommand from './commands/plugin/uploadPlugin';
import { cert } from './commands/project/cert';
import create from './commands/project/create';
import createPlugin from './commands/project/createPlugin';
import { dataDescribe } from './commands/project/data';
import { upgrade, UPGRADE_PARTS } from './commands/project/upgrade';
import { verify } from './commands/project/verify';
import { registerElement } from './commands/register/element';
import { registerFunctions } from './commands/register/functions';
import { groupHelp } from './commands/register/helpGroups';
import { API_OPTION, DRY_RUN_OPTION } from './commands/register/options';
import { registerPage } from './commands/register/page';
import { registerRuns } from './commands/runs/register';
import addRuntime from './commands/runtime/addRuntime';
import {
  powerRuntime,
  runtimeStatus,
  setRuntimeSize,
  setRuntimeVariable,
  unsetRuntimeVariable
} from './commands/runtime/runtime';
import { serverList, serverReset, serverStop } from './commands/server/server';
import packSourceCommand from './commands/source/packSource';
import { activity } from './commands/space/activity';
import { explainCommand } from './commands/space/explain';
import { fix } from './commands/space/fix';
import { spaceImpact, spaceOverview } from './commands/space/overview';
import { pull, PULL_PARTS, pullParts } from './commands/space/pull';
import { push, PUSH_PARTS } from './commands/space/push';
import { watchPass, watchSpace } from './commands/space/watch';
import { doctor } from './doctor';
import { feedback } from './feedback';
import { lint } from './lint';
import { count, positiveInteger, swallowedFlag } from './options';
import { acceptTokenEverywhere } from './runs/core/usage';
import { CREATE_TEMPLATES, PACKAGE_MANAGERS } from './scaffold';
import { projectExec, projectRun } from './scaffold/packageManager';
import { CLI_VERSION } from './scaffold/project';

import type { AccountOptions, WhoamiOptions } from './commands/account/account';
import type { AddPluginOptions } from './commands/plugin/addPlugin';
import type { PackPluginOptions } from './commands/plugin/packPlugin';
import type { UploadPluginOptions } from './commands/plugin/uploadPlugin';
import type { CertOptions } from './commands/project/cert';
import type { CreateOptions } from './commands/project/create';
import type { CreatePluginOptions } from './commands/project/createPlugin';
import type { DataDescribeOptions } from './commands/project/data';
import type { UpgradeOptions } from './commands/project/upgrade';
import type { VerifyOptions } from './commands/project/verify';
import type { RunCommandOptions } from './commands/runs';
import type { AddRuntimeOptions } from './commands/runtime/addRuntime';
import type { RuntimeOptions, RuntimeStatusOptions } from './commands/runtime/runtime';
import type { ServerResetOptions, ServerStopOptions } from './commands/server/server';
import type { PackSourceOptions } from './commands/source/packSource';
import type { ActivityOptions } from './commands/space/activity';
import type { ExplainOptions } from './commands/space/explain';
import type { FixOptions } from './commands/space/fix';
import type { PullOptions } from './commands/space/pull';
import type { PushOptions } from './commands/space/push';
import type { WatchOptions } from './commands/space/watch';
import type { DoctorOptions } from './doctor';
import type { FeedbackOptions } from './feedback';
import type { LintOptions } from './lint';

/** A flag given more than once, as the list of every value. */
const collect = (value: string, previous: string[]): string[] => [...previous, value];

/** The flags that shape a PROJECT: given with `--plugin`, they are a mistake worth saying rather than ignoring. */
const PROJECT_ONLY = ['mode', 'source', 'key', 'template'] as const;

/**
 * The command line for Plitzi.
 *
 * The gap it closes first is between installing the SDK and having a page on screen. Everything needed for that was
 * documented, which was the problem — a person had to read four things and write three files correctly before they
 * could tell whether any of it worked. The same holds for an element of one's own, which is the second thing it does.
 */

export const buildProgram = (): Command => {
  const program = new Command();

  program.name('plitzi').description('Plitzi command line').version(CLI_VERSION);
  // Set before any subcommand, which copies it: every refused command line says what it most likely meant.
  program.configureOutput({
    outputError: (text, write) => {
      write(text);
      const hint = commandHint(text, process.argv.slice(2));
      if (hint) {
        write(`  Next: ${hint}\n`);
      }
    }
  });
  // Every command: a flag whose value is the next flag is refused before it runs, never read as what it was not.
  program.hook('preAction', (_program, action) => {
    const swallowed = swallowedFlag(action);
    if (swallowed) {
      action.error(swallowed);
    }
  });

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

  const serverGroup = program
    .command('server')
    .description(
      `This project’s own servers — what ${projectRun('start')} left listening from this folder — listed, and stopped safely`
    );

  serverGroup
    .command('list')
    .description('What listens from this folder, and whether its /health says it is this project')
    .option('--json', 'One object, for a tool or an agent')
    .action((options: { json?: boolean }) => serverList(options));

  serverGroup
    .command('stop')
    .description(
      'Stop this project’s server — on --port, or every one — and what it started; never by name, never another folder’s'
    )
    .addOption(new Option('--port <port>', 'The one on this port alone').argParser(positiveInteger))
    .option('--json', 'One object, for a tool or an agent')
    .action((options: ServerStopOptions) => serverStop(options));

  serverGroup
    .command('reset')
    .description(
      'What this folder’s server keeps (state/: its kv, its jobs) back to a cold start — refused while one of its servers runs'
    )
    .option(...DRY_RUN_OPTION)
    .option('--json', 'One object, for a tool or an agent')
    .action((options: ServerResetOptions) => serverReset(options));

  spaceGroup
    .command('pull')
    .argument(
      '[parts...]',
      `Only these: ${PULL_PARTS.join(', ')} — into any project connected to the space. None named: the whole space`
    )
    .description(
      'Bring a project made with create --from up to date with its space: what changed there is written, what changed here is kept'
    )
    .option(
      '-f, --force',
      'Where a file changed both here and on the space, take the space’s copy — with functions, overwrite what is not pushed'
    )
    .option(
      '-e, --environment <environment>',
      'Follow another version from now on: main (the draft), or a published environment'
    )
    .option('--revision <n>', 'Pin a published revision of it, or latest to follow its newest again')
    .option(...API_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((parts: string[], options: PullOptions) =>
      parts.length === 0 ? pull(options) : pullParts(parts, options)
    );

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
      'Write the space’s runtime in src/runtime/: its own server code, run by this project’s server and by Plitzi (plitzi space push runtime)'
    )
    .option('-f, --force', 'Write over a runtime the project already has')
    .option(...DRY_RUN_OPTION)
    .action((options: AddRuntimeOptions) => addRuntime(options));

  pluginGroup
    .command('pack')
    .argument(
      '[folders...]',
      'Element folders to pack, the main one first. In a plugin package, left out: all of them.'
    )
    .description(
      'Build a plugin: one ES module, its plugin-manifest.json, and the zip the builder takes under Resources'
    )
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
    .description(
      'Write the source snapshot plitzi plugin upload and plitzi space push runtime keep beside what they send'
    )
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

  spaceGroup
    .command('fix')
    .description(
      'What authoring would fix in the space, as edits to your source: shown as a diff; with --write written, formatted and checked'
    )
    .option('--write', 'Write the edits — kept only when the space authors with each fix gone and no problem added')
    .option('--json', 'The plan as one object, for a tool or an agent')
    .action((options: FixOptions) => fix(options));

  program
    .command('verify')
    .description(
      'Whether the project is left passing: author, lints, types, its tests, format and every page, only the problems said'
    )
    .option('--no-pages', 'Leave the pages out — said as such')
    .option('--keep-going', 'Run every check even after one fails — by default the first failure ends the run')
    .option('--json', 'One object, for a tool or an agent')
    .action((options: VerifyOptions) => verify(options));

  program
    .command('explain')
    .argument(
      '[name]',
      'An element, a step, a trigger, a problem’s code, a transformer or a helper: container, navigate, class-and-css, bindTemplate, motion — or words, quoted, for what they describe, best first: "carousel end", "checked state"'
    )
    .description(
      'What a name means when authoring a space — what it takes, fires, reads and how it is written; several words, what has them: elements, their fields, steps, states, sources, codes, commands'
    )
    .option(
      '--list <kind>',
      'Every name of a kind: elements, steps, triggers, codes, transformers, helpers, filters, functions, sources, tasks, types'
    )
    .option('--json', 'One object, for a tool or an agent')
    .action((name: string | undefined, options: ExplainOptions) => explainCommand(name, options, program.commands));

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
      `Whether the project the CLI set up is whole — packages, its files, configs, what Node runs, plugins, data files, functions, records — each problem with its fix. Not the space: that is \`${projectRun('author')}\`, and how it is written \`plitzi space lint\``
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
      'Start a report to Plitzi: writes the page in .plitzi/plitzi-reports/agents/<date>/ with the versions and the project already in it, and tells the agent how to fill and publish it — to send as a link'
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
      `How the space in src/space/ is written, eslint’s way: each practice to change at its file and line, what to write instead, and what authoring suggests. Not whether it authors — \`${projectRun('author')}\` — nor the project: \`plitzi doctor\``
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
    .command('overview')
    .description(
      'Who owns which file, read off the imports: each page, layout, component and plugin, and what they share'
    )
    .argument('[unit]', 'One unit whole — every file it owns and shares: src/space/pages/room.ts, src/plugins/Chat/')
    .option('--json', 'One object, for a tool or an agent')
    .action((unit: string | undefined, options: RunCommandOptions) => spaceOverview(unit, options));

  spaceGroup
    .command('impact')
    .description('What depends on a file, all the way back: the files that import it and the units it touches')
    .argument('<file>', 'The project file')
    .option('--json', 'One object, for a tool or an agent')
    .action((file: string, options: RunCommandOptions) => spaceImpact(file, options));

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

  registerFunctions(program);

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

  registerPage(pageGroup);
  registerElement(elementGroup);
  registerRuns(program);

  // What a person new to Plitzi reads first, by what it is for — as the commands' folders are: the project and its
  // space, keeping the project whole, its own code on the platform, the account, and apart — never in the way of the
  // rest — the multi-agent ones, which only a team of agents asked for uses.
  groupHelp(program, [
    {
      heading: 'Make and change a project — what an agent uses by default:',
      commands: ['create', 'space', 'page', 'element', 'plugin', 'data', 'explain', 'verify']
    },
    {
      heading: 'Keep the project whole — its machinery, its servers, HTTPS on your network:',
      commands: ['upgrade', 'doctor', 'server', 'cert']
    },
    {
      heading: 'Its own code on Plitzi — functions, the runtime, the source kept beside them:',
      commands: ['functions', 'runtime', 'source']
    },
    {
      heading: 'Your account, and Plitzi:',
      commands: ['login', 'logout', 'whoami', 'feedback']
    },
    {
      heading: 'Multi-agent — a team of agents on one project, only when one is asked for (plitzi run start "…"):',
      commands: ['run', 'task']
    }
  ]);
  program.addHelpText(
    'after',
    `
  New to it? Make a project, then ask your agent for what you want — it works the project with the commands above:
    npx @plitzi/cli create my-site     a project that renders a space, its skills for your agent in .claude/skills/
    ${projectRun('start').padEnd(35)}serve it
    ${projectExec('plitzi verify').padEnd(35)}left passing: author, lints, types, tests, format, every page

  Alone, or a team of agents (multi-agent mode): your agent works alone by default. A team — several agents, in
  parallel, each task in a copy of the project — is for a job big enough to split, and only when you ask for one:
    plitzi run start "<what you want>"   checked, opened on its scope; plitzi run --help says every step after

  Docs: https://docs.plitzi.com — a team of agents: https://docs.plitzi.com/guides/team`
  );
  acceptTokenEverywhere(program);

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

  return program;
};
