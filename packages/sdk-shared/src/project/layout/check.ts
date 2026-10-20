import { readFileSync } from 'node:fs';
import path from 'node:path';

import { dataFindings, envFindings, publicFindings } from './contents';
import { exists } from './files';
import { nearMissFindings, spaceFindings } from './folders';
import { isRecord } from '../../helpers/isRecord';
import { AUTHOR_FILE, FUNCTIONS_DIR, RUNTIME_DIR, SPACE_DIR } from '../paths';
import { pluginFindings, sourceEntryFindings } from './plugins';

import type { LayoutFinding, ProjectLayoutOptions } from './codes';

const dependsOnServer = (root: string): boolean => {
  try {
    const manifest: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));

    return (
      isRecord(manifest) &&
      [manifest.dependencies, manifest.devDependencies].some(
        dependencies => isRecord(dependencies) && '@plitzi/sdk-server' in dependencies
      )
    );
  } catch {
    return false;
  }
};

/** What the project is, from its files when not said: a server's dependency; a space folder or the author script. */
const optionsOf = (root: string, options: ProjectLayoutOptions): Required<ProjectLayoutOptions> => ({
  mode: options.mode ?? (dependsOnServer(root) ? 'server' : 'client'),
  space: options.space ?? (exists(root, SPACE_DIR, 'folder') || exists(root, AUTHOR_FILE, 'file') ? 'local' : 'cloud')
});

/**
 * Everything out of place in the project at `root`, errors first: what its server, its authoring and `plitzi doctor`
 * say of its layout. `PROJECT_LAYOUT_CODES` says what each code means.
 */
export const checkProjectLayout = (root: string, options: ProjectLayoutOptions = {}): LayoutFinding[] => {
  const known = optionsOf(root, options);
  const misplaced = nearMissFindings(root, known);
  const findings = [
    ...pluginFindings(root),
    ...sourceEntryFindings(root, {
      folder: FUNCTIONS_DIR,
      accepted: ['index.ts'],
      code: 'functions-entry-missing',
      lost: 'none of the project’s functions runs',
      write: `Write ${FUNCTIONS_DIR}/index.ts exporting defineFunctions({ … }) by default.`
    }),
    ...sourceEntryFindings(root, {
      folder: RUNTIME_DIR,
      accepted: ['index.ts'],
      code: 'runtime-entry-missing',
      lost: 'the space’s runtime does not run',
      write: `Write ${RUNTIME_DIR}/index.ts exporting defineRuntime(…) by default — npx plitzi runtime add writes one.`
    }),
    ...(known.space === 'local' ? spaceFindings(root, misplaced) : []),
    ...misplaced,
    ...envFindings(root),
    ...(known.mode === 'server' ? dataFindings(root) : []),
    ...publicFindings(root, known.mode)
  ];

  return [...findings.filter(each => each.level === 'error'), ...findings.filter(each => each.level === 'warning')];
};

/** One finding as the terminal says it: what is wrong, then what to do. */
export const layoutFindingText = (layoutFinding: LayoutFinding): string =>
  `${layoutFinding.message}\n  → ${layoutFinding.fix}`;

/**
 * The errors of a project's layout, every one at once: what its server and its authoring refuse to start with.
 * `findings` holds them as data, for a tool that says them its own way.
 */
export class ProjectLayoutError extends Error {
  // Off the error's own fields: a process that ends on it prints those beside the message, which says it all.
  readonly #findings: readonly LayoutFinding[];

  get findings(): readonly LayoutFinding[] {
    return this.#findings;
  }

  constructor(findings: readonly LayoutFinding[]) {
    const count = findings.length === 1 ? 'one error' : `${String(findings.length)} errors`;
    const list = findings.map((each, index) => `${String(index + 1)}. ${each.message}\n   → ${each.fix}`).join('\n\n');
    const fixable = findings.filter(each => each.autofix).length;
    const fixed = fixable === findings.length ? 'these fixes' : `${String(fixable)} of these fixes`;
    const doctor =
      fixable > 0
        ? `npx plitzi doctor --fix makes ${fixed} itself.`
        : 'npx plitzi doctor says these with the rest of the project.';
    super(`The project is not laid out as Plitzi reads it — ${count}:\n\n${list}\n\n${doctor}`);
    this.name = 'ProjectLayoutError';
    this.#findings = findings;
  }
}

// A bundler renames a class it inlines (`@plitzi/sdk-authoring` carries this one inside it), and a process that ends on
// the error prints the constructor's name beside its own: `$ [ProjectLayoutError]`.
Object.defineProperty(ProjectLayoutError, 'name', { value: 'ProjectLayoutError' });

/**
 * The project's layout, refused with every error at once (`ProjectLayoutError`) — what its server and its authoring
 * check before anything else — and its warnings answered, for the caller to say.
 */
export const assertProjectLayout = (root: string, options: ProjectLayoutOptions = {}): LayoutFinding[] => {
  const findings = checkProjectLayout(root, options);
  const errors = findings.filter(each => each.level === 'error');
  if (errors.length > 0) {
    throw new ProjectLayoutError(errors);
  }

  return findings;
};
