import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { projectModule } from './projectModules';
import { editTsConfig, freshSecret, ignoreLines, unignore } from './repairs';
import { sayer } from './types';
import { CLI_DIR, MAIN_FILE, PROJECT_STATE, PROJECT_TMP } from '../scaffold/paths';

import type { Check, DoctorContext, Finding, Repair } from './types';

/**
 * What the tools read beside the code: the TypeScript configs (what Node can run is what they let through), what git
 * keeps out — a secret above all — and `.env`, what the server starts with.
 */

const say = sayer('config');

const readOptional = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

/** JSON with the comments and trailing commas a `tsconfig` may hold — as TypeScript itself reads one. */
export const parseJsonc = (text: string): unknown => {
  let out = '';
  let inString = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      out += char;
      if (char === '\\') {
        out += text[index + 1] ?? '';
        index++;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') {
        index++;
      }

      out += '\n';
    } else if (char === '/' && text[index + 1] === '*') {
      index = text.indexOf('*/', index + 2);
      if (index === -1) {
        break;
      }

      index++;
    } else {
      out += char;
    }
  }

  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
};

type TsConfig = { extends?: string; include: string[]; options: Record<string, unknown> };

const readTsConfig = async (root: string, file: string): Promise<TsConfig | { problem: string } | undefined> => {
  const text = await readOptional(path.join(root, file));
  if (text === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = parseJsonc(text);
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }

  if (!isRecord(parsed)) {
    return { problem: 'it is not an object' };
  }

  return {
    ...(typeof parsed.extends === 'string' ? { extends: parsed.extends } : {}),
    include: Array.isArray(parsed.include) ? parsed.include.filter(entry => typeof entry === 'string') : [],
    options: isRecord(parsed.compilerOptions) ? parsed.compilerOptions : {}
  };
};

/** A repair that may be none, spread into a finding's details. */
const repairOf = async (made: Promise<Repair | undefined>): Promise<{ repair?: Repair }> => {
  const repair = await made;

  return repair ? { repair } : {};
};

/**
 * What Node needs of the source, that only the typecheck can hold it to: a relative import names its `.ts` file, a
 * type is imported as one, and nothing is written that stripping the types would leave broken (an `enum`).
 */
const NODE_OPTIONS: readonly { option: string; why: string }[] = [
  { option: 'allowImportingTsExtensions', why: 'the `.ts` a relative import must name for Node fails the typecheck' },
  {
    option: 'verbatimModuleSyntax',
    why: 'a type imported without `import type` passes the typecheck and fails at start'
  },
  { option: 'erasableSyntaxOnly', why: 'an `enum` or a parameter property passes the typecheck and fails at start' }
];

const tsconfigChecks = async ({ root, answers }: DoctorContext): Promise<Finding[]> => {
  const config = await readTsConfig(root, 'tsconfig.json');
  if (!config) {
    return [];
  }

  if ('problem' in config) {
    return [
      say.error('tsconfig-unreadable', `tsconfig.json cannot be read: ${config.problem}.`, {
        file: 'tsconfig.json',
        fix: 'plitzi upgrade files shows the CLI’s'
      })
    ];
  }

  const findings: Finding[] = [];
  const included = (folder: string) =>
    editTsConfig(root, 'tsconfig.json', `adds "${folder}" to tsconfig.json's "include"`, json => {
      const include: unknown = json.include;
      json.include = [...(Array.isArray(include) ? include.filter(entry => typeof entry === 'string') : []), folder];
    });
  const covers = (folder: string) =>
    config.include.length === 0 || config.include.some(entry => entry === folder || entry.startsWith(`${folder}/`));
  if (!covers('src')) {
    findings.push(
      say.error('tsconfig-src-left-out', 'tsconfig.json leaves src/ out: the typecheck reads none of the project.', {
        file: 'tsconfig.json',
        fix: 'Add "src" to "include".',
        ...(await repairOf(included('src')))
      })
    );
  }

  if (!covers(CLI_DIR)) {
    findings.push(
      say.warning('tsconfig-cli-left-out', `tsconfig.json leaves ${CLI_DIR}/ out: the typecheck reads none of it.`, {
        file: 'tsconfig.json',
        fix: `Add "${CLI_DIR}" to "include".`,
        ...(await repairOf(included(CLI_DIR)))
      })
    );
  }

  // A base it extends may set them: only a config standing on its own is held to them.
  if (!config.extends) {
    for (const { option, why } of NODE_OPTIONS) {
      if (config.options[option] !== true) {
        findings.push(
          say.warning('tsconfig-node-option', `tsconfig.json does not set ${option}: ${why}.`, {
            file: 'tsconfig.json',
            fix: `Set "${option}": true in "compilerOptions".`
          })
        );
      }
    }
  }

  return answers.mode === 'server' ? [...findings, ...(await buildChecks(root))] : findings;
};

/** What `start:prod` runs is what `build` emits: `tsconfig.build.json` puts `src/main.ts` where the script looks. */
const buildChecks = async (root: string): Promise<Finding[]> => {
  const build = await readTsConfig(root, 'tsconfig.build.json');
  if (!build) {
    return [];
  }

  if ('problem' in build) {
    return [
      say.error('tsconfig-unreadable', `tsconfig.build.json cannot be read: ${build.problem}.`, {
        file: 'tsconfig.build.json',
        fix: 'plitzi upgrade files shows the CLI’s'
      })
    ];
  }

  const manifest: unknown = JSON.parse((await readOptional(path.join(root, 'package.json'))) ?? '{}');
  const scripts = isRecord(manifest) && isRecord(manifest.scripts) ? manifest.scripts : {};
  const startProd = typeof scripts['start:prod'] === 'string' ? scripts['start:prod'] : '';
  const builds = typeof scripts.build === 'string' && scripts.build.includes('tsconfig.build.json');
  const runs = /node\s+(?:--\S+\s+)*(\S+\.js)\b/.exec(startProd)?.[1];
  const { outDir, rootDir } = build.options;
  if (!builds || !runs || typeof outDir !== 'string' || typeof rootDir !== 'string') {
    return [];
  }

  const emitted = path.join(outDir, path.relative(rootDir, MAIN_FILE)).replace(/\.ts$/, '.js');
  if (path.normalize(emitted) === path.normalize(runs)) {
    return [];
  }

  return [
    say.error(
      'build-misses-start',
      `build writes ${MAIN_FILE} to ${emitted}, and start:prod runs ${runs}: production would start nothing.`,
      { file: 'tsconfig.build.json', fix: `Make "outDir"/"rootDir" emit ${runs}, or run ${emitted} in start:prod.` }
    )
  ];
};

/** Whether a `.gitignore` line keeps `name` (a file or folder at the root) out of git: as git reads a plain line. */
const keepsOut = (lines: readonly string[], name: string): boolean =>
  lines.some(line => {
    const pattern = line.replace(/^\//, '').replace(/\/$/, '');
    if (pattern.includes('/')) {
      return false;
    }

    const glob = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`);

    return glob.test(name);
  });

const gitignoreChecks = async ({ root, answers }: DoctorContext): Promise<Finding[]> => {
  const text = await readOptional(path.join(root, '.gitignore'));
  if (text === undefined) {
    return [];
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('!'));
  const findings: Finding[] = [];
  const wanted = [
    { name: 'node_modules', why: 'what is installed' },
    { name: PROJECT_TMP, why: 'what the project writes for itself' },
    ...(answers.mode === 'server'
      ? [
          { name: 'dist', why: 'what build emits' },
          { name: PROJECT_STATE, why: 'what its server keeps (the kv)' }
        ]
      : [])
  ];
  const missing = wanted.filter(({ name }) => !keepsOut(lines, name));
  const env = !keepsOut(lines, '.env');
  // One edit for every line missing: said by each finding, made once.
  const ignored = ignoreLines(root, [...(env ? ['.env'] : []), ...missing.map(({ name }) => name)]);
  if (env) {
    findings.push(
      say.error('env-not-ignored', '.gitignore does not keep .env out: its secrets would be committed.', {
        file: '.gitignore',
        fix: 'Add .env to .gitignore.',
        repair: ignored
      })
    );
  }

  for (const { name, why } of missing) {
    findings.push(
      say.warning('not-ignored', `.gitignore does not keep ${name}/ out: ${why} would be committed.`, {
        file: '.gitignore',
        fix: `Add ${name} to .gitignore.`,
        repair: ignored
      })
    );
  }

  if (keepsOut(lines, '.plitzi')) {
    findings.push(
      say.error(
        'records-ignored',
        '.gitignore keeps .plitzi/ out: a clone could not pull, push or upgrade without what it records.',
        { file: '.gitignore', fix: 'Remove .plitzi from .gitignore, and commit it.', repair: unignore(root, '.plitzi') }
      )
    );
  }

  return findings;
};

/** The files git tracks of those named, or nothing when the project is not in a repository (or there is no git). */
const tracked = (root: string, files: readonly string[]): Promise<string[]> =>
  new Promise(resolve => {
    execFile('git', ['ls-files', '--', ...files], { cwd: root }, (error, stdout) => {
      resolve(error ? [] : stdout.split('\n').filter(Boolean));
    });
  });

const gitChecks = async ({ root, answers }: DoctorContext): Promise<Finding[]> => {
  const committed = await tracked(root, ['.env', ...(answers.mode === 'server' ? [PROJECT_STATE] : [])]);
  const findings: Finding[] = [];
  if (committed.includes('.env')) {
    findings.push(
      say.error('env-committed', '.env is in git: whoever has the repository has its secrets.', {
        file: '.env',
        fix: 'git rm --cached .env — and make new secrets: the ones it held stay in the history.'
      })
    );
  }

  if (committed.some(file => file.startsWith(`${PROJECT_STATE}/`))) {
    findings.push(
      say.warning(
        'state-committed',
        `${PROJECT_STATE}/ is in git: what the server kept while developing is committed.`,
        {
          file: PROJECT_STATE,
          fix: `git rm -r --cached ${PROJECT_STATE}`
        }
      )
    );
  }

  return findings;
};

/** The minimum the project's own server holds a signing secret to — or nothing, when it cannot be asked. */
const minimumSecret = async (root: string): Promise<number | undefined> => {
  const actions = await projectModule(root, '@plitzi/sdk-server/actions').catch(() => undefined);
  const minimum = isRecord(actions) ? actions.MIN_SIGNING_SECRET_LENGTH : undefined;

  return typeof minimum === 'number' ? minimum : undefined;
};

/** What the process starts with: what `.env` sets, under what the environment already has — as the server reads it. */
const settingsOf = async (root: string): Promise<{ file: boolean; value: (name: string) => string }> => {
  const text = await readOptional(path.join(root, '.env'));
  const parsed = text === undefined ? {} : parseEnv(text);

  return { file: text !== undefined, value: name => process.env[name] ?? parsed[name] ?? '' };
};

const envChecks = async ({ root, answers }: DoctorContext): Promise<Finding[]> => {
  const settings = await settingsOf(root);
  const where = settings.file ? '.env' : 'the environment (there is no .env)';
  const findings: Finding[] = [];
  if (answers.mode === 'client') {
    if (answers.source === 'cloud' && !settings.value('VITE_PLITZI_WEB_KEY')) {
      findings.push(
        say.error('key-missing', `VITE_PLITZI_WEB_KEY is not set in ${where}: the page cannot read the space.`, {
          file: '.env',
          fix: 'Set VITE_PLITZI_WEB_KEY — the space’s render key, under Credentials in the builder.'
        })
      );
    }

    return findings;
  }

  if (answers.source === 'cloud') {
    if (!settings.value('PLITZI_HOST_KEY')) {
      findings.push(
        say.error('key-missing', `PLITZI_HOST_KEY is not set in ${where}: the server does not start.`, {
          file: '.env',
          fix: 'Set PLITZI_HOST_KEY — the space’s self-hosting key, under Credentials in the builder.'
        })
      );
    }

    const revision = settings.value('PLITZI_REVISION');
    if (revision && !/^[1-9]\d*$/.test(revision)) {
      findings.push(
        say.error('revision-invalid', `PLITZI_REVISION is "${revision}": a revision is a number, 1 or more.`, {
          file: '.env',
          fix: 'Set it to a published revision, or remove it to follow the environment’s latest.'
        })
      );
    }
  }

  const secret = settings.value('PLITZI_SIGNING_SECRET');
  const minimum = await minimumSecret(root);
  // Only `.env`'s: one the process's own environment sets wins over the file, and is the deployment's to change.
  const secretRepair =
    process.env.PLITZI_SIGNING_SECRET === undefined ? { repair: freshSecret(root, 'PLITZI_SIGNING_SECRET') } : {};
  if (!secret) {
    findings.push(
      say.warning(
        'signing-secret-missing',
        `PLITZI_SIGNING_SECRET is not set in ${where}: the space's actions sign nothing (ctx.sign, ctx.verify).`,
        { file: '.env', fix: 'Set PLITZI_SIGNING_SECRET=$(openssl rand -hex 32) in .env.', ...secretRepair }
      )
    );
  } else if (minimum !== undefined && secret.length < minimum) {
    findings.push(
      say.error(
        'signing-secret-short',
        `PLITZI_SIGNING_SECRET is ${String(secret.length)} characters, and the server wants ${String(minimum)} or more: it does not start.`,
        { file: '.env', fix: 'Set PLITZI_SIGNING_SECRET=$(openssl rand -hex 32) in .env.', ...secretRepair }
      )
    );
  }

  return findings;
};

export const checkConfig: Check = async context => [
  ...(await tsconfigChecks(context)),
  ...(await gitignoreChecks(context)),
  ...(await gitChecks(context)),
  ...(await envChecks(context))
];
