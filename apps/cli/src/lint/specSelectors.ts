import fs from 'node:fs/promises';
import path from 'node:path';

import { finding } from './catalog';

import type { LintFinding } from './types';
import type { SpaceHandles } from '@plitzi/sdk-authoring';

/** The folders a project's tests are not in: what is installed, built or kept by the tools. */
const SKIPPED = new Set(['node_modules', 'dist', 'tmp', '.plitzi', '.git', 'public']);

const TEST_FILE = /\.(spec|test)\.[cm]?[jt]sx?$/;

/** An element named by `data-plitzi-el` in a selector a test writes: `[data-plitzi-el="room-desk"]`. */
const NAMED = /data-plitzi-el\s*=\s*\\?["']([\w-]+)\\?["']/g;

const testFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const found = await Promise.all(
    entries.map(async entry => {
      if (entry.isDirectory()) {
        return SKIPPED.has(entry.name) ? [] : testFiles(path.join(dir, entry.name));
      }

      return TEST_FILE.test(entry.name) ? [path.join(dir, entry.name)] : [];
    })
  );

  return found.flat();
};

/**
 * A test's selector naming a component's instance by `data-plitzi-el`, which finds nothing: an instance has no node of
 * its own, its name is on the component's root as `data-plitzi-instance`. Matching nothing, `toBeHidden()` passes and a
 * "both sides" test holds nothing — encore-4's tester met it three times.
 */
export const specSelectorFindings = async (root: string, handles: SpaceHandles): Promise<LintFinding[]> => {
  const files = await testFiles(root);
  const found = await Promise.all(
    files.map(async file => {
      const text = await fs.readFile(file, 'utf-8').catch(() => '');
      const relative = path.relative(root, file);

      return [...text.matchAll(NAMED)].flatMap(match => {
        const id = match[1];
        const handle = Object.hasOwn(handles.elements, id) ? handles.elements[id] : undefined;
        if (handle?.selector.startsWith('[data-plitzi-instance') !== true) {
          return [];
        }

        const before = text.slice(0, match.index);
        const line = before.split('\n').length;

        return [
          finding(
            'selector-instance',
            `\`[data-plitzi-el="${id}"]\` finds nothing: "${id}" is a component's instance, which has no node of its own — its name is on the component's root, \`${handle.selector}\`. Take the selector from \`handles.element('${id}').selector\` (or \`locate('${id}')\`), which says which.`,
            { file: relative, line, column: match.index - before.lastIndexOf('\n') }
          )
        ];
      });
    })
  );

  return found.flat();
};
