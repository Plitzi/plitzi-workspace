import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import {
  INSTALL_HINTS,
  ask,
  atTerminal,
  cdPrefix,
  install,
  isEmpty,
  nearestExisting,
  refuseWithoutTerminal,
  runScript,
  writeFiles
} from './terminal';
import {
  PACKAGE_MANAGERS,
  detectManagerVersion,
  detectPackageManager,
  installCommand,
  runCommand,
  scaffold
} from '../scaffold';

import type { Question } from './terminal';
import type { CreateAnswers, PackageManager } from '../scaffold';

/**
 * A project that renders a Plitzi space, ready to run.
 *
 * Two decisions shape it and nothing else does: whether there is a Node tier (`--mode`), and where the space
 * comes from (`--source`). Everything a person had to read four documents to assemble is written out here
 * instead, so the first minute is `install` then `start`.
 */

export interface CreateOptions {
  mode?: string;
  source?: string;
  key?: string;
  environment?: string;
  packageManager?: string;
  install?: boolean;
  force?: boolean;
  /** At a terminal, take the defaults for whatever was not passed instead of asking. Without one it answers nothing. */
  yes?: boolean;
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
    console.error(chalk.red(`${target} is not empty. Pass --force to write into it anyway.`));
    process.exitCode = 1;

    return;
  }

  const decisions = await resolveDecisions(options);
  if (!decisions) {
    return;
  }

  const { packageManager, mode, source } = decisions;

  // A cloud project is nothing without its credential, so it is the one thing worth stopping to ask for.
  if (source === 'cloud' && !options.key && !atTerminal()) {
    refuseWithoutTerminal('project', [{ flag: '--key', choices: ['<key>'], question: keyQuestion(mode) }]);

    return;
  }

  const key = source === 'cloud' ? (options.key ?? (await askForKey(mode))) : '';
  if (source === 'cloud' && !key) {
    console.error(chalk.red('\nNo key. Mint one under Credentials in the builder, then run this again.'));
    process.exitCode = 1;

    return;
  }

  const answers: CreateAnswers = {
    name,
    mode,
    source,
    key,
    environment: options.environment ?? 'main',
    packageManager,
    managerVersion: detectManagerVersion(packageManager, await nearestExisting(target))
  };

  await writeFiles(target, scaffold(answers));

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
    console.error(
      chalk.red(
        `\n\`${installCommand(packageManager)}\` failed. The project is written; the reason is in the output above.`
      )
    );
    console.error(chalk.dim(INSTALL_HINTS[packageManager]));
    process.exitCode = 1;
  }

  /**
   * Formatted by the project's own Prettier, once, so the first commit is already in its style — the scaffold writes
   * tables and lists whose layout depends on what they hold. Only into a folder that was empty: `--force` into one
   * with work in it must never reformat that work.
   */
  if (installed && wasEmpty) {
    await runScript(packageManager, 'format', target);
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

  console.log('');
};

export default create;
