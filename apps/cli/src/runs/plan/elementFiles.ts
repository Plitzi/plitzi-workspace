import fs from 'node:fs/promises';
import path from 'node:path';

import { expectedIds } from './expectations';
import { shellCommands } from '../core/shell';

import type { PlannedTask } from '../core/model';

/**
 * Where the elements a task's checks read are written, held to the task's files: a run's t-result-card was
 * given `match/styles.ts` alone, its acceptance measured the judges' block — written in `pages/combate.ts` and
 * `match/parts.ts`, another task's — and its second round waited for that task's approval. Said at `run open --dry-run`.
 */

/** An element's own name, as an id is written: what a source file names it by (`id: 'match-judges'`). */
const ELEMENT = /^[a-z][\w-]*$/i;

/** The elements a check reads: `page check --expect`/`--element`, and what `page measure` measures on our side. */
export const checkedElements = (check: string): string[] =>
  [
    ...expectedIds(check).map(each => each.element),
    ...shellCommands(check).flatMap(words => {
      const at = words.findIndex(
        (word, index) => word === 'page' && ['measure', 'check'].includes(words[index + 1] ?? '')
      );
      if (at === -1) {
        return [];
      }

      const args = words.slice(at + 2);
      if (words[at + 1] === 'check') {
        return args.flatMap((word, index) => (word === '--element' && args[index + 1] ? [args[index + 1] ?? ''] : []));
      }

      // `page measure <path> <element…>`: the elements up to the first option, each ours before its `=>`.
      const firstOption = args.findIndex(word => word.startsWith('--'));
      const positional = firstOption === -1 ? args : args.slice(0, firstOption);

      return positional.slice(1).map(each => each.split('=>')[0]?.trim() ?? '');
    })
  ].filter(element => ELEMENT.test(element));

/** Every authored source of the space, read once: where its elements are named. */
const spaceSources = async (root: string): Promise<Map<string, string>> => {
  const dir = path.join(root, 'src', 'space');
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  const files = entries.filter(
    entry => entry.isFile() && /\.[cm]?tsx?$/.test(entry.name) && !entry.name.includes('.test.')
  );

  return new Map(
    await Promise.all(
      files.map(
        async entry =>
          [
            path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'),
            await fs.readFile(path.join(entry.parentPath, entry.name), 'utf-8')
          ] as const
      )
    )
  );
};

/** The space's files a source imports by a relative path, as its file names are kept: `../mediaCommon.ts` from faq.ts. */
const importsOf = (file: string, text: string, files: ReadonlySet<string>): string[] =>
  [...text.matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g)].flatMap(([, specifier]) => {
    const base = path.posix.join(path.posix.dirname(file), specifier);
    const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(each => files.has(each));

    return found ? [found] : [];
  });

/**
 * Each task whose checks read an element written in none of its files, nor in a file that imports one of them: where
 * it is written, to give it the file. A helper or a token the element's file imports is the task's way to it —
 * A run's t-body-type changed the FAQ's answers through `fore()`, in a file of its own, and was told otherwise.
 */
export const elementFileNotices = async (root: string, tasks: readonly PlannedTask[]): Promise<string[]> => {
  const asked = tasks.map(task => ({
    task,
    elements: [
      ...new Set(task.acceptance.flatMap(each => (typeof each === 'string' ? [] : checkedElements(each.check))))
    ]
  }));
  if (asked.every(each => each.elements.length === 0)) {
    return [];
  }

  const sources = await spaceSources(root);
  const names = new Set(sources.keys());
  const writtenIn = (element: string): string[] =>
    [...sources].flatMap(([file, text]) =>
      new RegExp(`\\bid:\\s*['"\`]${element.replace(/[-]/g, '\\-')}['"\`]`).test(text) ? [file] : []
    );

  // What a task this one waits on holds, it changes first — may move or remove the element (t-home-top told
  // its checks read hero-title in index.ts, the tour's, which t-base before it removed).
  const before = (task: PlannedTask): Set<string> => {
    const found = new Set<string>();
    const visit = (id: string): void => {
      for (const dep of tasks.find(each => each.id === id)?.dependsOn ?? []) {
        if (!found.has(dep)) {
          found.add(dep);
          visit(dep);
        }
      }
    };
    visit(task.id);

    return new Set(tasks.filter(each => found.has(each.id)).flatMap(each => [...each.files, ...(each.touches ?? [])]));
  };

  return asked.flatMap(({ task, elements }) => {
    const changedBefore = before(task);
    const elsewhere = elements.flatMap(element => {
      const files = writtenIn(element).filter(file => !changedBefore.has(file));

      const reached = (file: string): boolean =>
        task.files.includes(file) ||
        importsOf(file, sources.get(file) ?? '', names).some(imported => task.files.includes(imported));

      return files.length > 0 && !files.some(reached) ? [`${element} (${files.join(', ')})`] : [];
    });

    return elsewhere.length > 0
      ? [
          `Task "${task.id}"'s checks read ${elsewhere.join(', ')} — written in none of its files: give it those files, or its change to them waits for whoever holds them`
        ]
      : [];
  });
};
