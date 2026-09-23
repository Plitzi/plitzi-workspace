import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import {
  PACKAGE_MANAGERS,
  detectManagerVersion,
  detectPackageManager,
  installCommand,
  runCommand,
  scaffold
} from '../scaffold';

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

/** A directory that does not exist yet is as empty as one can be, which is the answer this question wants. */
const isEmpty = async (target: string): Promise<boolean> => {
  try {
    return (await fs.readdir(target)).length === 0;
  } catch {
    return true;
  }
};

const isDirectory = async (candidate: string): Promise<boolean> => {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
};

/** The closest directory that already exists: the project's own does not until its files are written. */
const nearestExisting = async (target: string): Promise<string> => {
  let dir = target;
  while (!(await isDirectory(dir)) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }

  return dir;
};

/**
 * What a first install is most likely refused over, and what to do about it.
 *
 * The scaffold already exempts what it ships, but not the rest of the tree: a third-party dependency published in
 * the last day is held back by the same age gates, and says so in a code that means nothing to somebody who has
 * not touched the project yet.
 */
const INSTALL_HINTS: Record<PackageManager, string> = {
  npm: 'A peer-dependency conflict (ERESOLVE) is a bug in this scaffold: please report it. `npm install --legacy-peer-deps` gets past it meanwhile.',
  yarn: 'YN0016 ("quarantined") means a dependency was published less than a day ago. Wait, or add it to `npmPreapprovedPackages` in .yarnrc.yml.',
  pnpm: 'A dependency published too recently is added to `minimumReleaseAgeExclude` in pnpm-workspace.yaml; a skipped build script is approved with `pnpm approve-builds`.'
};

const install = (manager: PackageManager, cwd: string): Promise<boolean> =>
  new Promise(resolve => {
    const child = spawn(manager, ['install'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });

/**
 * The choices a project is BUILT around, which belong to whoever it is for — never to a default nobody chose.
 *
 * Each one is written into the project: the package manager into every command its README, lockfile, Playwright config
 * and install use; the mode into whether there is a Node tier at all; the source into whether the space is in the repo.
 * Assumed, they are the wrong project for somebody, and an agent running this was the one assuming. So what was not
 * passed is asked for when a person is at the terminal, and refused when nobody is — with the exact questions to put
 * to the person.
 */
type Question<T extends string> = { flag: string; choices: readonly T[]; question: string; given?: T; fallback: T };

/** Somebody who can answer a prompt. An agent's shell, CI and a pipe are nobody, whatever they were asked to do. */
const atTerminal = (): boolean => process.stdin.isTTY && process.stdout.isTTY;

/**
 * Nobody to ask, so the questions go to whoever ran this — in practice an agent — to put to the person.
 *
 * It offers no way around them. It used to end with "or with --yes to take the defaults", and an agent keen to finish
 * took that exit every time: the person was never asked, which is the whole failure this stop exists to prevent.
 */
const refuseWithoutTerminal = (questions: { flag: string; choices: readonly string[]; question: string }[]) => {
  console.error(
    chalk.red(
      '\nplitzi create stopped before writing anything: these choices shape the whole project, they belong to the ' +
        'person it is for, and nobody is at this terminal to make them.'
    )
  );
  console.error(
    chalk.bold(
      '\nIf you are an AI agent: ask the user each question below, show them the options, and wait for their answers. ' +
        'Do not choose for them and do not fall back to a default.\n'
    )
  );
  questions.forEach(({ flag, choices, question }, index) => {
    console.error(`  ${index + 1}. ${question}`);
    console.error(`     ${flag} ${choices.join(' | ')}`);
  });

  const flags = questions.map(({ flag }) => `${flag} <their answer>`).join(' ');
  console.error(`\nThen run the same command again with their answers: ${flags}`);
  process.exitCode = 1;
};

/** One choice at the terminal: Enter takes the default, anything off the list is refused rather than guessed at. */
const ask = async <T extends string>(rl: readline.Interface, question: Question<T>): Promise<T | undefined> => {
  const reply = (
    await rl.question(
      `\n${question.question}\n${question.flag} (${question.choices.join('/')}) [${question.fallback}] > `
    )
  ).trim();
  const chosen = question.choices.find(choice => choice === (reply || question.fallback));
  if (!chosen) {
    console.error(chalk.red(`"${reply}" is not one of ${question.choices.join(', ')}.`));
  }

  return chosen;
};

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
    refuseWithoutTerminal(missing);

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

  if (!options.force && !(await isEmpty(target))) {
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
    refuseWithoutTerminal([{ flag: '--key', choices: ['<key>'], question: keyQuestion(mode) }]);

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

  const files = scaffold(answers);

  await Promise.all(
    Object.entries(files).map(async ([file, contents]) => {
      const destination = path.join(target, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });

      return fs.writeFile(destination, contents);
    })
  );

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
   * How to get there, in whichever form is shorter.
   *
   * A relative path out of a temp directory is six `../` and unreadable; an absolute one to a sibling folder is
   * noise. These lines are meant to be pasted, so they are printed the way somebody would have typed them.
   */
  const relative = path.relative(process.cwd(), target);
  const where = target === process.cwd() ? '' : `cd ${relative.length < target.length ? relative : target} && `;

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
