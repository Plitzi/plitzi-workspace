import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  AUTHOR_FILE,
  DATA_DIR,
  FUNCTIONS_DIR,
  PLUGIN_DECLARATION_FILE,
  PLUGIN_ENTRIES,
  PLUGINS_DIR,
  PUBLIC_DIR,
  RUNTIME_DIR,
  SOURCE_DIR,
  SPACE_DIR,
  SPACE_ENTRY
} from '../paths';
import { finding } from './codes';
import { CASE_NOTE, capitalized, entriesOf, exists, gitMove, nearName, sameIgnoringCase } from './files';
import { entryFindings } from './plugins';

import type { LayoutAutofix, LayoutFinding, ProjectLayoutOptions } from './codes';

/** A folder the server reads, and what in a folder named like it says it was meant for it. */
interface ReadFolder {
  /** Where it is, relative to the root. */
  at: string;
  /** What reads it, said after "did you mean …?". */
  reads: string;
  /** What, in a folder named like it, is unmistakably meant for it — nothing, when only the name tells. */
  holds?: (folder: string) => string | undefined;
}

/** The first of `wanted` among `files`, case aside: an entry is named before a declaration. */
const hasIgnoringCase = (files: readonly string[], wanted: readonly string[]): string | undefined =>
  wanted.map(each => files.find(file => sameIgnoringCase(file, each))).find(file => file !== undefined);

/** A plugin in a folder: a subfolder with an entry or a declaration. */
const holdsPlugin =
  (root: string) =>
  (folder: string): string | undefined => {
    for (const sub of entriesOf(path.join(root, folder)).folders) {
      const file = hasIgnoringCase(entriesOf(path.join(root, folder, sub)).files, [
        ...PLUGIN_ENTRIES,
        PLUGIN_DECLARATION_FILE
      ]);
      if (file) {
        return `${folder}/${sub}/${file}`;
      }
    }

    return undefined;
  };

const holdsEntry =
  (root: string) =>
  (folder: string): string | undefined => {
    const file = hasIgnoringCase(entriesOf(path.join(root, folder)).files, ['index.ts']);

    return file ? `${folder}/${file}` : undefined;
  };

/** The folders the server reads that a project may misname, for this project. */
const readFolders = (root: string, { mode, space }: Required<ProjectLayoutOptions>): ReadFolder[] => [
  { at: PLUGINS_DIR, reads: `the server builds plugins from ${PLUGINS_DIR}/ only`, holds: holdsPlugin(root) },
  {
    at: FUNCTIONS_DIR,
    reads: `the project's functions are built from ${FUNCTIONS_DIR}/ only`,
    holds: holdsEntry(root)
  },
  { at: RUNTIME_DIR, reads: `the space's runtime is run from ${RUNTIME_DIR}/ only`, holds: holdsEntry(root) },
  ...(space === 'local'
    ? [
        {
          at: SPACE_DIR,
          reads: `the server's entry point and ${AUTHOR_FILE} import the space from ${SPACE_ENTRY}`,
          holds: holdsEntry(root)
        }
      ]
    : []),
  ...(mode === 'server'
    ? [{ at: DATA_DIR, reads: `the server reads the project's data from ${DATA_DIR}/ only (/data/<file>, ctx.data)` }]
    : []),
  { at: PUBLIC_DIR, reads: `the server serves ${PUBLIC_DIR}/ only, at the site's root` }
];

/** Where a folder named like `at` may be by mistake: beside it, or a level up or down — `plugins/`, `src/public/`. */
const nearMissesOf = (root: string, at: string): string[] => {
  const parent = path.posix.dirname(at);
  const name = path.posix.basename(at);
  const other = parent === '.' ? SOURCE_DIR : '.';
  const besides = entriesOf(path.join(root, parent))
    .folders.filter(folder => nearName(folder, name))
    .map(folder => path.posix.join(parent, folder));
  const elsewhere = entriesOf(path.join(root, other))
    .folders.filter(folder => folder === name || nearName(folder, name))
    .map(folder => path.posix.join(other, folder));

  return [...besides, ...elsewhere];
};

export const nearMissFindings = (root: string, options: Required<ProjectLayoutOptions>): LayoutFinding[] =>
  readFolders(root, options).flatMap(({ at, reads, holds }) =>
    nearMissesOf(root, at).map(found => {
      const held = holds?.(found);
      const caseOnly = sameIgnoringCase(found, at);
      const said = `did you mean ${at}/? ${capitalized(reads)}.${caseOnly ? ` ${CASE_NOTE}` : ''}`;
      let fix = `Move it: ${gitMove(found, at)}`;
      if (caseOnly) {
        fix = `Rename it: ${gitMove(found, at)}`;
      } else if (exists(root, at, 'folder')) {
        fix = `Move what it holds into ${at}/, and delete it.`;
      }

      const autofix: LayoutAutofix = { action: 'move', from: `${found}/`, to: `${at}/` };

      return held
        ? finding(
            'folder-misplaced',
            `${found}/`,
            `${found}/ holds ${held}, and nothing reads it there — ${said}`,
            fix,
            autofix
          )
        : finding('folder-near-miss', `${found}/`, `${found}/ is read by nothing — ${said}`, fix, autofix);
    })
  );

/** The space's entry, in a project whose space is its own: there, and exporting the space by the name it is imported by. */
export const spaceFindings = (root: string, misplaced: readonly LayoutFinding[]): LayoutFinding[] => {
  if (!exists(root, SPACE_ENTRY, 'file')) {
    // A space folder misnamed (`src/Space/`) is said once, as that.
    const misnamed = misplaced.some(
      each => each.code === 'folder-misplaced' && each.autofix?.action === 'move' && each.autofix.to === `${SPACE_DIR}/`
    );

    return misnamed
      ? []
      : entryFindings(root, {
          folder: SPACE_DIR,
          accepted: ['index.ts'],
          code: 'space-entry-missing',
          lost: `the server's entry point and ${AUTHOR_FILE}, which import the space from ${SPACE_ENTRY}, do not start`,
          write: `Write ${SPACE_ENTRY} exporting the space — export const space = { name, permanentUrl, pages } — or bring back the one git has: git checkout -- ${SPACE_ENTRY}`
        });
  }

  const text = readFileSync(path.join(root, SPACE_ENTRY), 'utf-8');
  const byDefault = /^\s*export\s+default\b/m.test(text);
  const byName =
    /\bexport\s+(?:const|let|var|function)\s+space\b/.test(text) || /\bexport\s*\{[^}]*\bspace\b[^}]*\}/.test(text);

  return byDefault && !byName
    ? [
        finding(
          'space-default-export',
          SPACE_ENTRY,
          `${SPACE_ENTRY} exports the space by default, and it is imported by name — import { space } from './space/index.ts' — so the server's entry point and ${AUTHOR_FILE} find no space.`,
          'Export it as `export const space = …` instead of `export default …`.'
        )
      ]
    : [];
};
