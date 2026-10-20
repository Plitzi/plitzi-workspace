import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DATA_DIR, PUBLIC_DIR, RUNS_DIR, SOURCE_DIR } from '../paths';
import { finding } from './codes';
import { NOT_SOURCE, entriesOf, filesUnder } from './files';

import type { LayoutFinding } from './codes';

/** `.env` with every value taken out — its comments and the names it sets kept: what `.env.example` is made from. */
const emptied = (env: string): string =>
  env
    .split('\n')
    .map(line => line.replace(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=).*$/, '$1'))
    .join('\n');

/** Settings where Node reads them: `.env` at the root, `.env.example` beside it — and none inside `src/`. */
export const envFindings = (root: string): LayoutFinding[] => {
  const atRoot = entriesOf(root).files;
  const hasEnv = atRoot.includes('.env');
  const hasExample = atRoot.includes('.env.example');
  const inSource = filesUnder(root, SOURCE_DIR, new Set(['node_modules'])).filter(
    file => path.posix.basename(file) === '.env'
  );
  // Only one, and none at the root, is moved: two, or one beside the root's, are merged by whoever knows what they set.
  const movable = !hasEnv && inSource.length === 1;
  const misplaced = inSource.map(file =>
    finding(
      'env-in-src',
      file,
      `${file} is never read: Node reads the project's settings from the .env at its root, as its scripts start it (--env-file-if-exists=.env).`,
      movable ? `Move it to the root: mv ${file} .env` : `Copy what it sets into the root's .env, then delete ${file}.`,
      movable ? { action: 'move', from: file, to: '.env' } : undefined
    )
  );
  // A task's copy of the project, inside a run, holds no .env on purpose: its agent never reads credentials.
  const inRunCopy = `${path.resolve(root).split(path.sep).join('/')}/`.includes(`/${RUNS_DIR}/`);
  // One misplaced is said as that: moved, it is the root's.
  const missing =
    hasEnv || inRunCopy || misplaced.length > 0
      ? []
      : [
          finding(
            'env-missing',
            '.env',
            '.env is missing at the project’s root: none of its settings is set — the keys and secrets its code reads from process.env.',
            hasExample
              ? 'Copy .env.example and fill it in: cp .env.example .env'
              : 'Write .env with the settings the project reads (process.env.*), and .env.example naming them.',
            hasExample ? { action: 'copy', from: '.env.example', to: '.env' } : undefined
          )
        ];
  const example = hasExample
    ? []
    : [
        finding(
          'env-example-missing',
          '.env.example',
          '.env.example is missing: committed where .env never is, it names the settings .env holds, with no secret in them — so a clone knows what to fill in.',
          hasEnv
            ? 'Write it from .env with every value left empty, and commit it.'
            : 'Write it — each setting the project reads, as KEY= with no value — and commit it.',
          hasEnv
            ? {
                action: 'write',
                file: '.env.example',
                contents: emptied(readFileSync(path.join(root, '.env'), 'utf-8'))
              }
            : undefined
        )
      ];

  return [...misplaced, ...missing, ...example];
};

/** Anything in `src/data/` but JSON: a provider's `/data/<file>` and `ctx.data` read JSON alone. */
export const dataFindings = (root: string): LayoutFinding[] =>
  filesUnder(root, DATA_DIR)
    .filter(file => !NOT_SOURCE.has(path.posix.basename(file)) && !file.endsWith('.json'))
    .map(file =>
      finding(
        'data-not-json',
        file,
        `${file} is not JSON: a provider's /data/<file> and ctx.data read JSON files only, and plitzi space push leaves it behind.`,
        `Keep it as JSON (${file.replace(/\.[^./]*$/, '')}.json), or move it out of ${DATA_DIR}/.`
      )
    );

/** A name that says a file holds a secret, a key or a database: never a file to serve. */
const SECRET_NAME =
  /^\.env(?:\..*)?$|\.(?:pem|key|p12|pfx|jks|keystore|sqlite3?|db|sql|dump)$|secret|credential|password|passwd|private[-_.]?key|id_rsa|id_ed25519|service[-_]?account/i;

/**
 * What `public/` serves that had better be kept: files named like a secret, in any project — and, in one with a
 * server, which has a folder of data it never serves, the JSON of `public/data/`.
 */
export const publicFindings = (root: string, mode: 'server' | 'client'): LayoutFinding[] => {
  const files = filesUnder(root, PUBLIC_DIR, new Set(['node_modules']));
  const secrets = files
    .filter(file => SECRET_NAME.test(path.posix.basename(file)))
    .map(file =>
      finding(
        'public-secret-file',
        file,
        `${file} is served to anyone who asks, as it is — everything in ${PUBLIC_DIR}/ is on the internet once the project is deployed — and its name says it holds a secret, a key or a database.`,
        `Take it out of ${PUBLIC_DIR}/: settings go in the root's .env${mode === 'server' ? `, data only the server reads in ${DATA_DIR}/` : ''}.`
      )
    );
  const publicData = `${PUBLIC_DIR}/data`;
  const json =
    mode === 'server' ? files.filter(file => file.startsWith(`${publicData}/`) && file.endsWith('.json')) : [];
  const listed = json.slice(0, 3).map(file => path.posix.basename(file));
  const data =
    json.length > 0
      ? [
          finding(
            'public-data',
            `${publicData}/`,
            `${publicData}/ holds ${String(json.length)} JSON file${json.length === 1 ? '' : 's'} (${listed.join(', ')}${json.length > listed.length ? ', …' : ''}), served to anyone who asks: every visitor can read all of ${json.length === 1 ? 'it' : 'them'}, not only what a page shows.`,
            `Data only the server should read goes in ${DATA_DIR}/ — a provider reads it on the server (runtime: 'server', query: '/data/<file>'), a function with ctx.data('<file>'), and neither serves the file. What every visitor may read can stay.`
          )
        ]
      : [];

  return [...secrets, ...data];
};
