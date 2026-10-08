import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { build } from 'esbuild';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { filesWouldWrite, sayDryRun } from './dryRun';
import { projectHere } from './existingProject';
import { fail } from './terminal';
import { FUNCTIONS_DIR } from '../scaffold/paths';

import type { DryRunOptions } from './dryRun';

/** Where a package added to the functions is kept: their own code from then on, copied in. */
export const VENDOR_DIR = 'vendor';

/** What a space's functions may weigh built, whole — a package added is part of it (`@plitzi/sdk-server`'s cap). */
const MAX_FUNCTIONS_BYTES = 1_000_000;

/** A package's name, as npm writes one: `ical.js`, `@scope/name`. */
const PACKAGE_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

/** Globals of Node a package may read and a runner does not have: said, since a bundle cannot tell if they run. */
const NODE_GLOBALS =
  /\b(process\.(env|nextTick|platform|versions?)|Buffer\.(from|alloc|isBuffer)|__dirname|__filename)\b/;

/** The file a package is kept in, under `src/functions/vendor/`: its name, with its scope folded in. */
export const vendorFileOf = (name: string): string => `${name.replace(/^@/, '').replace('/', '__')}.js`;

/** The package's own `package.json`, found from where it resolves: its version and its licence for the header. */
const manifestOf = async (entry: string, name: string): Promise<{ version: string; license: string }> => {
  for (let dir = path.dirname(entry); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
      if (isRecord(parsed) && parsed.name === name) {
        return {
          version: typeof parsed.version === 'string' ? parsed.version : '?',
          license: typeof parsed.license === 'string' ? parsed.license : 'no licence stated'
        };
      }
    } catch {
      // Not this folder's: the one above, then.
    }
  }

  return { version: '?', license: 'no licence stated' };
};

/**
 * One package bundled for the functions: web APIs only, as they run — what reaches Node (`fs`, `node:crypto`) does
 * not resolve on a neutral platform, and is the reason it is refused. With what it exports, for its types.
 */
const bundle = async (
  root: string,
  name: string,
  withDefault: boolean
): Promise<{ code: string; exports: string[] } | { errors: { text: string }[] }> => {
  try {
    const result = await build({
      stdin: {
        contents: `export * from '${name}';${withDefault ? `\nexport { default } from '${name}';` : ''}`,
        resolveDir: root,
        loader: 'js'
      },
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'neutral',
      mainFields: ['module', 'main'],
      target: 'es2022',
      minify: true,
      legalComments: 'inline',
      logLevel: 'silent'
    });
    // One entry, one output: what it exports is what the types re-export.
    const exports = Object.values(result.metafile.outputs).flatMap(output => output.exports);

    return { code: result.outputFiles.map(output => output.text).join(''), exports };
  } catch (error) {
    return {
      errors:
        isRecord(error) && Array.isArray(error.errors)
          ? error.errors.flatMap(entry =>
              isRecord(entry) && typeof entry.text === 'string' ? [{ text: entry.text }] : []
            )
          : [{ text: error instanceof Error ? error.message : String(error) }]
    };
  }
};

/** Why esbuild could not bundle it, in the words that say what to do: a Node module is a package that cannot run here. */
const refusalOf = (name: string, errors: readonly { text: string }[]): string => {
  const node = errors
    .map(entry => /Could not resolve "([^"]+)"/.exec(entry.text)?.[1])
    .find((module): module is string => module !== undefined && !module.startsWith('.'));

  return node
    ? `${name} reaches "${node}", which the functions do not have: they run with web APIs only — fetch, crypto.subtle, URL — on any runner, so a package that needs Node cannot run there. Look for one written for the browser or the edge.`
    : `${name} could not be bundled: ${errors.map(entry => entry.text).join('; ')}`;
};

/**
 * `plitzi functions add <package>`: a package the functions use, as a function carries its dependencies — bundled into
 * `src/functions/vendor/`, and from then on their own code: pushed and built with the rest, read by the builder, run by
 * the runner. Nothing is resolved anywhere else, so a space's functions stay its own files. Installed first, with the
 * project's package manager, so its version is the project's choice and its types reach the editor.
 */
export const addFunctionsPackage = async (name: string, options: DryRunOptions): Promise<void> => {
  if (!PACKAGE_NAME.test(name)) {
    fail(`"${name}" is not a package's name — ical.js, @scope/name.`);

    return;
  }

  const root = (await projectHere('whose functions these are'))?.root;
  if (!root) {
    return;
  }

  let entry: string;
  try {
    entry = createRequire(path.join(root, 'package.json')).resolve(name);
  } catch {
    // ESM-only packages answer no `require`: their `package.json` is still there to say it is installed.
    try {
      entry = createRequire(path.join(root, 'package.json')).resolve(`${name}/package.json`);
    } catch {
      fail(`${name} is not installed in this project: install it first (npm install --save-dev ${name}), then add it.`);

      return;
    }
  }

  let built = await bundle(root, name, true);
  // Not every package has a default export: asked for, it is an error of its own — asked again without it.
  if ('errors' in built && built.errors.some(entry => /No matching export .*"default"/.test(entry.text))) {
    built = await bundle(root, name, false);
  }

  if ('errors' in built) {
    fail(refusalOf(name, built.errors));

    return;
  }

  const bytes = Buffer.byteLength(built.code);
  if (bytes > MAX_FUNCTIONS_BYTES) {
    fail(
      `${name} is ${String(Math.round(bytes / 1024))} KB bundled, and a space's functions are at most ${String(MAX_FUNCTIONS_BYTES / 1000)} KB built, all of it: look for a smaller one, or import less of it.`
    );

    return;
  }

  const { version, license } = await manifestOf(entry, name);
  const file = vendorFileOf(name);
  const relative = `./${VENDOR_DIR}/${file}`;
  const header =
    `// ${name}@${version} — ${license}. Added by \`plitzi functions add ${name}\`: the package bundled for the functions\n` +
    `// (web APIs only), imported as '${relative}'. Not to be edited: run it again to update it.\n`;
  // Its types are the installed package's, re-exported: what the editor and the project's typecheck read.
  const named = built.exports.filter(exported => exported !== 'default');
  const types = `// The types of ${name}@${version}, for '${relative}' — the installed package's own.\n${
    named.length > 0 ? `export * from '${name}';\n` : ''
  }${built.exports.includes('default') ? `export { default } from '${name}';\n` : ''}`;
  const written = {
    [path.join(VENDOR_DIR, file)]: `${header}${built.code}`,
    [path.join(VENDOR_DIR, file.replace(/\.js$/, '.d.ts'))]: types
  };

  const base = path.join(root, FUNCTIONS_DIR);
  if (options.dryRun) {
    sayDryRun(`plitzi functions add ${name}`, [
      ...(await filesWouldWrite(base, Object.keys(written))).map(line => line.replace(/^(.) /, `$1 ${FUNCTIONS_DIR}/`))
    ]);

    return;
  }

  for (const [target, text] of Object.entries(written)) {
    await fs.mkdir(path.dirname(path.join(base, target)), { recursive: true });
    await fs.writeFile(path.join(base, target), text);
  }

  console.log(
    `Added ${name}@${version} (${String(Math.round(bytes / 1024))} KB) as ${FUNCTIONS_DIR}/${VENDOR_DIR}/${file}: ` +
      `import it from a file of ${FUNCTIONS_DIR}/ with '${relative}' — \`functions push\` saves it with the rest.`
  );
  if (NODE_GLOBALS.test(built.code)) {
    console.warn(
      `${name} reads globals of Node (process, Buffer, __dirname) somewhere: the functions have none, so whatever reads them fails when it runs. Try what you use with \`plitzi functions dev\`.`
    );
  }
};
