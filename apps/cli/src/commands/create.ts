import { randomBytes } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { apiFor } from './account';
import { fetchExport, recordOrigin, versionLabel, writeFromSpace } from './createFrom';
import { filesWouldWrite, sayDryRun } from './dryRun';
import { digestOf, SCAFFOLD_RECORD_FILE, scriptsOf, writeScaffoldRecord } from './scaffoldRecord';
import { ORIGIN_FILE } from './spaceOrigin';
import {
  ask,
  atTerminal,
  cdPrefix,
  fail,
  install,
  INSTALL_HINTS,
  isEmpty,
  nearestExisting,
  refuseWithoutTerminal,
  runScript,
  writeFiles
} from './terminal';
import {
  CREATE_TEMPLATES,
  PACKAGE_MANAGERS,
  detectManagerVersion,
  detectPackageManager,
  installCommand,
  machineryFiles,
  runCommand,
  scaffold
} from '../scaffold';
import { envFromSpace, projectFromSpace } from '../scaffold/fromSpace';
import { CLI_VERSION, packageJson, withSigningSecret } from '../scaffold/project';

import type { DryRunOptions } from './dryRun';
import type { Question } from './terminal';
import type { CreateAnswers, PackageManager, ProjectFiles } from '../scaffold';

/**
 * A project that renders a Plitzi space, ready to run.
 *
 * Two decisions shape it and nothing else does: whether there is a Node tier (`--mode`), and where the space
 * comes from (`--source`). Everything a person had to read four documents to assemble is written out here
 * instead, so the first minute is `install` then `start`.
 */

export interface CreateOptions extends DryRunOptions {
  mode?: string;
  source?: string;
  key?: string;
  environment?: string;
  /** A published environment's revision: pinned, rather than its latest. With `--from` or `--source cloud`. */
  revision?: string;
  packageManager?: string;
  install?: boolean;
  force?: boolean;
  /** At a terminal, take the defaults for whatever was not passed instead of asking. Without one it answers nothing. */
  yes?: boolean;
  /**
   * A space on Plitzi to make the project from (docs/en/projects-from-spaces.md): its id or permanent URL. The project then holds what the
   * space is made of — pages, actions, functions, runtime, plugins and files — and serves it on its own.
   */
  from?: string;
  /** The platform `--from` reads the space from. */
  api?: string;
  /** What a local space starts as: `welcome` (the default), `blank` or `catalog`. */
  template?: string;
}

const MODES = ['server', 'client'] as const;
const SOURCES = ['local', 'cloud'] as const;

type Decisions = { packageManager: PackageManager; mode: (typeof MODES)[number]; source: (typeof SOURCES)[number] };

/**
 * The choices a project is BUILT around, which belong to whoever it is for — never to a default nobody chose.
 *
 * Each one is written into the project: the package manager into every command its README, lockfile, Playwright config
 * and install use; the mode into whether there is a Node tier at all; the source into whether the space is in the repo.
 * Assumed, they are the wrong project for somebody, and an agent running this was the one assuming. So what was not
 * passed is asked for when a person is at the terminal, and refused when nobody is — with the exact questions to put
 * to the person.
 */
const resolveDecisions = async (options: CreateOptions): Promise<Decisions | undefined> => {
  const detected = detectPackageManager();
  const packageManager: Question<PackageManager> = {
    flag: '--package-manager',
    choices: PACKAGE_MANAGERS,
    question: `Which package manager will you work in? (this was run through ${detected})`,
    given: PACKAGE_MANAGERS.find(manager => manager === options.packageManager),
    fallback: detected
  };
  const mode: Question<Decisions['mode']> = {
    flag: '--mode',
    choices: MODES,
    question: 'Should pages render on a Node server of your own (server: SSR + RSC), or only in the browser (client)?',
    given: MODES.find(candidate => candidate === options.mode),
    fallback: 'server'
  };
  const source: Question<Decisions['source']> = {
    flag: '--source',
    choices: SOURCES,
    question:
      'Should the space live in the project as code you edit (local), or be read live from your Plitzi account ' +
      '(cloud, which needs a key from Credentials in the builder)?',
    given: SOURCES.find(candidate => candidate === options.source),
    fallback: 'local'
  };
  const missing = [packageManager, mode, source].filter(question => question.given === undefined);

  if (missing.length === 0 || (options.yes && atTerminal())) {
    return {
      packageManager: packageManager.given ?? packageManager.fallback,
      mode: mode.given ?? mode.fallback,
      source: source.given ?? source.fallback
    };
  }

  // `--yes` is a person at a terminal saying the defaults ARE their answer. With nobody there it is whoever ran this
  // deciding for them, which is the one thing not allowed.
  if (!atTerminal()) {
    refuseWithoutTerminal('project', missing);

    return undefined;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const manager = packageManager.given ?? (await ask(rl, packageManager));
    const tier = manager && (mode.given ?? (await ask(rl, mode)));
    const origin = tier && (source.given ?? (await ask(rl, source)));
    if (!manager || !tier || !origin) {
      process.exitCode = 1;

      return undefined;
    }

    return { packageManager: manager, mode: tier, source: origin };
  } finally {
    rl.close();
  }
};

const keyQuestion = (mode: string): string =>
  `The ${mode === 'server' ? 'self-hosting' : 'public render'} key the project reads the space with (Credentials, in the builder).`;

const askForKey = async (mode: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`\n${keyQuestion(mode)}\n> `)).trim();
  } finally {
    rl.close();
  }
};

const create = async (directory: string | undefined, options: CreateOptions): Promise<void> => {
  const target = path.resolve(directory ?? '.');
  const name = path.basename(target);

  const wasEmpty = await isEmpty(target);
  if (!options.force && !wasEmpty) {
    fail(`${target} is not empty. Pass --force to write into it anyway.`);

    return;
  }

  // A space taken out of Plitzi is served by a server of the project's own: there is no browser-only form of it.
  if (options.from && options.mode === 'client') {
    fail('A project made from a space runs its own server: leave out --mode, or pass --mode server.');

    return;
  }

  const environment = options.environment ?? 'main';
  const revision = options.revision === undefined ? undefined : Number(options.revision);
  if (revision !== undefined && (!Number.isInteger(revision) || revision < 1 || environment === 'main')) {
    fail(
      environment === 'main'
        ? 'The draft (main) has no revisions: name a published environment with --environment, then --revision.'
        : `--revision takes a revision number from 1, not "${options.revision ?? ''}".`
    );

    return;
  }

  const decisions = await resolveDecisions(options.from ? { ...options, mode: 'server' } : options);
  if (!decisions) {
    return;
  }

  const { packageManager, mode, source } = decisions;

  // A template is what a space written here starts as: one read from Plitzi, or taken out of it, already has its own.
  const template = CREATE_TEMPLATES.find(candidate => candidate === (options.template ?? 'welcome'));
  if (!template || (options.template !== undefined && (source === 'cloud' || options.from))) {
    fail(
      template
        ? '--template is what a space written in the project starts as: it goes with --source local, without --from.'
        : `--template is ${CREATE_TEMPLATES.join(' or ')}, not "${options.template ?? ''}".`
    );

    return;
  }

  // A project of its own carries its space: there is no published version for it to pin.
  if (revision !== undefined && !options.from && source === 'local') {
    fail('--revision pins a published version: it goes with --from, or with --source cloud.');

    return;
  }

  // A cloud project is nothing without its credential, so it is the one thing worth stopping to ask for.
  if (source === 'cloud' && !options.key && !atTerminal()) {
    refuseWithoutTerminal('project', [{ flag: '--key', choices: ['<key>'], question: keyQuestion(mode) }]);

    return;
  }

  const key = source === 'cloud' ? (options.key ?? (await askForKey(mode))) : '';
  if (source === 'cloud' && !key) {
    fail('\nNo key. Mint one under Credentials in the builder, then run this again.');

    return;
  }

  const asked: CreateAnswers = {
    name,
    mode,
    source,
    ...(template === 'welcome' ? {} : { template }),
    key,
    environment,
    ...(revision ? { revision } : {}),
    packageManager,
    managerVersion: detectManagerVersion(packageManager, await nearestExisting(target)),
    ...(options.from ? { fromSpace: true } : {})
  };

  // Asked for before anything is written: a space that cannot be had leaves no half-made project behind.
  const api = options.from ? await apiFor(options) : undefined;
  const exported =
    options.from && api
      ? await fetchExport(api, options.from, { source, version: { environment, ...(revision ? { revision } : {}) } })
      : undefined;
  if (options.from && !exported) {
    return;
  }

  // A space that came with a runtime gives the project one: the server runs it, and `start:dev` restarts on it.
  const answers: CreateAnswers =
    exported?.source.runtime || exported?.builtOnly.runtime ? { ...asked, runtime: true } : asked;
  const fromSpace = exported ? projectFromSpace(exported, source) : undefined;
  const files = Object.fromEntries(
    Object.entries(scaffold(answers)).filter(([file]) => !fromSpace?.omit.includes(file))
  );
  // The key its actions sign with, made for this project alone: the scaffold is the same for everybody.
  const signingSecret = randomBytes(32).toString('hex');
  const written: ProjectFiles =
    exported && fromSpace
      ? {
          ...files,
          ...fromSpace.files,
          'package.json': packageJson(answers, fromSpace.dependencies),
          '.env': envFromSpace(exported, answers, signingSecret)
        }
      : { ...files, '.env': withSigningSecret(files['.env'], signingSecret) };
  if (options.dryRun) {
    const wantsInstall = options.install !== false;
    sayDryRun(`plitzi create ${target}`, [
      ...(await filesWouldWrite(target, [...Object.keys(written), ...Object.keys(fromSpace?.binaries ?? {})])),
      ...(fromSpace?.downloads ?? []).map(({ url, to }) => `+ ${to} — fetched from ${url}`),
      `+ ${SCAFFOLD_RECORD_FILE} — what the CLI wrote, for \`plitzi upgrade\``,
      ...(exported ? [`+ ${ORIGIN_FILE} — the space it came from, for \`plitzi space pull\` and \`space push\``] : []),
      ...(wantsInstall ? [`run ${installCommand(packageManager)}`] : []),
      ...(wantsInstall && wasEmpty ? [`run ${runCommand(packageManager, 'format')}`] : [])
    ]);

    return;
  }

  await writeFiles(target, written);
  const missing = fromSpace ? await writeFromSpace(target, fromSpace) : [];
  // What of the CLI's machinery was written, by digest: what lets `plitzi upgrade` replace a file nobody touched since.
  // One the space gave in its place (`src/main.ts` of a project made from one) is the space's: `plitzi space pull` keeps it.
  await writeScaffoldRecord(target, CLI_VERSION, {
    files: Object.fromEntries(
      Object.keys(machineryFiles(answers))
        .filter(file => file in files && !(fromSpace && file in fromSpace.files))
        .map(file => [file, digestOf(files[file])])
    ),
    // And the scripts it wrote, so `upgrade` can tell one nobody changed from one the project made its own.
    scripts: scriptsOf(written['package.json']),
    packageManager
  });

  const wantsInstall = options.install !== false;
  const installed = wantsInstall && (await install(packageManager, target));

  /**
   * A failed install is a failed command, not a next step.
   *
   * The files are already written, so the summary below still prints — but printed on its own after a screen of
   * resolver errors it reads as success, and a script that ran `create` carries on into a project with no
   * `node_modules`.
   */
  if (wantsInstall && !installed) {
    fail(`\n\`${installCommand(packageManager)}\` failed. The project is written; the reason is in the output above.`);
    console.error(chalk.dim(INSTALL_HINTS[packageManager]));
  }

  /**
   * Formatted by the project's own Prettier, once, so the first commit is already in its style — the scaffold writes
   * tables and lists whose layout depends on what they hold. Only into a folder that was empty: `--force` into one
   * with work in it must never reformat that work.
   */
  if (installed && wasEmpty) {
    await runScript(packageManager, 'format', target);
  }

  if (api && exported && fromSpace) {
    await recordOrigin(target, { api, exported, source, pinned: revision !== undefined, project: fromSpace });
  }

  const where = cdPrefix(target);

  console.log(
    chalk.green(
      `\n${name} — ${mode === 'server' ? 'server-rendered' : 'browser-rendered'}, space ${source === 'cloud' ? 'from Plitzi' : 'in the project'}.`
    )
  );
  console.log('');
  if (!installed) {
    console.log(`  ${where}${installCommand(packageManager)}`);
  }

  console.log(`  ${where}${runCommand(packageManager, 'start')}`);
  console.log('');
  console.log(
    chalk.dim(
      `.claude/skills carries Plitzi's authoring skill; \`${runCommand(packageManager, 'visual')}\` opens the page and checks it.`
    )
  );
  if (source === 'cloud') {
    console.log(chalk.dim('.env holds the key and is already git-ignored.'));
  }

  if (exported) {
    const { version } = exported;
    const said = version.snapshot ? ` — “${version.snapshot.description}”, made ${version.snapshot.publishedAt}` : '';
    console.log(chalk.dim(`Taken from ${versionLabel(version)}${said}.`));
  }

  const notes = [...(fromSpace?.report ?? []), ...missing];
  if (exported && notes.length > 0) {
    console.log(chalk.yellow(`\nWhat to know about ${exported.space.name} here:`));
    notes.forEach(note => console.log(chalk.yellow(`  - ${note}`)));
  }

  console.log('');
};

export default create;
