import fs from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';

import esbuild from 'esbuild';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { failureOf } from './plugins';
import { sayer } from './types';
import {
  ACTIONS_ENTRY,
  AUTHOR_FILE,
  MAIN_FILE,
  PLUGINS_DIR,
  RUNTIME_ENTRY,
  SERVER_OPTIONS_FILE,
  SPACE_ENTRY
} from '../scaffold/paths';

import type { Check, DoctorContext, Finding } from './types';

/**
 * The code Node runs as it is written — the server and what it imports, `author`, the plugins' declarations — read the
 * way Node reads it, which the typecheck does not: a relative import names a file that is there, with its extension; a
 * JSON file is imported as one (`with { type: 'json' }`); no JSX; and every package imported is one `package.json`
 * declares — what production installs, for the server's own code. Each a project that type-checks and fails at start.
 */

const say = sayer('sources');

const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    stat => stat.isFile(),
    () => false
  );

/** The package an import names: `@plitzi/sdk-server/runtime` → `@plitzi/sdk-server`, `zod/v4` → `zod`. */
const packageOf = (specifier: string): string => {
  const parts = specifier.split('/');

  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const stringKeys = (value: unknown): string[] => (isRecord(value) ? Object.keys(value) : []);

/** How `from` imports `to`: relative, with its extension, as Node wants it. */
const specifierOf = (from: string, to: string): string => {
  const written = path.relative(path.dirname(from), to).split(path.sep).join('/');

  return written.startsWith('.') ? written : `./${written}`;
};

/** Where an import names a file Node would not find as written: the file it meant, when there is one. */
const meant = async (target: string): Promise<string | undefined> => {
  for (const candidate of [`${target}.ts`, `${target}.js`, path.join(target, 'index.ts')]) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

type Graph = {
  /** What the files run in production: the server and what it reads — where a dev-only package is not installed. */
  production: boolean;
  entries: string[];
};

type Walked = { findings: Finding[]; exports: Map<string, string[]> };

/** Every file reached from `entries`, as Node reaches it: what it would refuse to load, and what each entry exports. */
const walk = async ({ root, manifest }: DoctorContext, { production, entries }: Graph): Promise<Walked> => {
  const findings: Finding[] = [];
  const dependencies = new Set(stringKeys(manifest.dependencies));
  const devDependencies = new Set(stringKeys(manifest.devDependencies));
  const self = typeof manifest.name === 'string' ? manifest.name : undefined;
  const relative = (file: string): string => path.relative(root, file);
  const nodeResolution: esbuild.Plugin = {
    name: 'plitzi-doctor-node',
    setup: build => {
      build.onResolve({ filter: /.*/ }, async args => {
        if (args.kind === 'entry-point') {
          return undefined;
        }

        const importer = relative(args.importer);
        if (args.path.startsWith('.') || path.isAbsolute(args.path)) {
          const target = path.resolve(args.resolveDir, args.path);
          if (!(await exists(target))) {
            const candidate = await meant(target);
            findings.push(
              say.error(
                'import-unresolved',
                `${importer} imports ${args.path}, and there is no such file: Node adds no extension, and looks for no index.`,
                {
                  file: importer,
                  fix: candidate
                    ? `Import "${specifierOf(args.importer, candidate)}".`
                    : 'Point the import at a file that is there.'
                }
              )
            );

            return { path: target, external: true };
          }

          if (/\.(tsx|jsx)$/.test(target)) {
            findings.push(
              say.error(
                'node-jsx',
                `${importer} imports ${relative(target)}, which holds JSX — Node runs ${importer} as it is, and cannot read JSX.`,
                { file: importer, fix: 'Keep what Node runs free of components: import them only from the plugins.' }
              )
            );

            return { path: target, external: true };
          }

          if (target.endsWith('.json') && args.with.type !== 'json') {
            findings.push(
              say.error(
                'json-without-attribute',
                `${importer} imports ${relative(target)} without \`with { type: 'json' }\`: Node refuses it.`,
                { file: importer, fix: `import … from '${args.path}' with { type: 'json' };` }
              )
            );
          }

          return { path: target };
        }

        if (args.path.startsWith('#') || isBuiltin(args.path)) {
          return { path: args.path, external: true };
        }

        const name = packageOf(args.path);
        if (name !== self && !dependencies.has(name) && !devDependencies.has(name)) {
          findings.push(
            say.error(
              'undeclared-dependency',
              `${importer} imports ${name}, which package.json does not declare: it works while something else installs it.`,
              { file: importer, fix: `Add ${name} to "dependencies".` }
            )
          );
        } else if (production && !dependencies.has(name) && devDependencies.has(name)) {
          findings.push(
            say.warning(
              'dev-dependency-in-production',
              `${importer} runs in production and imports ${name}, a devDependency: an install for production leaves it out.`,
              { file: importer, fix: `Move ${name} to "dependencies".` }
            )
          );
        }

        return { path: args.path, external: true };
      });
    }
  };

  let result: esbuild.BuildResult<{ metafile: true; write: false }>;
  try {
    result = await esbuild.build({
      entryPoints: entries.map(entry => path.join(root, entry)),
      absWorkingDir: root,
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'node',
      outdir: path.join(root, 'tmp', 'doctor'),
      logLevel: 'silent',
      plugins: [nodeResolution]
    });
  } catch (error) {
    const messages = failureOf(error);

    return {
      findings: [
        ...findings,
        ...messages.map(message => {
          const at = message.location ? `${message.location.file}:${String(message.location.line)}` : undefined;

          return say.error('does-not-build', message.text, { ...(at ? { file: at } : {}) });
        })
      ],
      exports: new Map()
    };
  }

  const exports = new Map(
    Object.values(result.metafile.outputs).flatMap(output =>
      output.entryPoint ? [[output.entryPoint, output.exports] as const] : []
    )
  );

  return { findings, exports };
};

/** The plugin folders' declarations: what `author` and the server import, each by itself. */
const declarations = async (root: string): Promise<string[]> => {
  const folders = await fs.readdir(path.join(root, PLUGINS_DIR), { withFileTypes: true }).catch(() => []);
  const found = await Promise.all(
    folders
      .filter(entry => entry.isDirectory())
      .map(async entry => {
        const file = path.join(PLUGINS_DIR, entry.name, 'declaration.ts');

        return (await exists(path.join(root, file))) ? [file] : [];
      })
  );

  return found.flat();
};

const present = async (root: string, files: readonly string[]): Promise<string[]> =>
  (await Promise.all(files.map(async file => ((await exists(path.join(root, file))) ? [file] : [])))).flat();

/** What an entry must export, as what loads it reads it: by name, never found out at start. */
const EXPECTED: readonly { file: string; name: string; why: string }[] = [
  { file: SPACE_ENTRY, name: 'space', why: 'the space `author`, the server and `plitzi space push` read' },
  { file: ACTIONS_ENTRY, name: 'actions', why: 'the list the server runs and `plitzi space push` sends' },
  { file: RUNTIME_ENTRY, name: 'default', why: 'the runtime the server starts (`defineRuntime({ … })`)' }
];

export const checkSources: Check = async context => {
  const { root, answers } = context;
  const local = answers.source === 'local';
  const declared = await declarations(root);
  const tooling = await present(root, [...(local ? [AUTHOR_FILE] : []), ...declared]);
  const server =
    answers.mode === 'server'
      ? await present(root, [
          MAIN_FILE,
          SERVER_OPTIONS_FILE,
          ...(local || answers.fromSpace ? [ACTIONS_ENTRY] : []),
          ...(local ? [SPACE_ENTRY] : []),
          RUNTIME_ENTRY
        ])
      : [];
  const walked = await Promise.all([
    server.length > 0 ? walk(context, { production: true, entries: server }) : undefined,
    tooling.length > 0 ? walk(context, { production: false, entries: tooling }) : undefined
  ]);
  const findings = walked.flatMap(each => each?.findings ?? []);
  // Each said once, though both graphs reach it: the space is the server's and `author`'s alike.
  const unique = [...new Map(findings.map(finding => [`${finding.code}:${finding.message}`, finding])).values()];
  const exports = new Map(walked.flatMap(each => [...(each?.exports ?? [])]));
  for (const { file, name, why } of EXPECTED) {
    const exported = exports.get(file);
    if (exported && !exported.includes(name)) {
      unique.push(
        say.error('export-missing', `${file} exports no ${name === 'default' ? 'default' : `\`${name}\``}: ${why}.`, {
          file
        })
      );
    }
  }

  for (const file of declared) {
    const exported = exports.get(file);
    if (exported && !exported.includes('default')) {
      unique.push(
        say.error(
          'export-missing',
          `${file} exports no default: the plugin's declaration, \`export default { type, … }\`.`,
          {
            file
          }
        )
      );
    }
  }

  return unique;
};
