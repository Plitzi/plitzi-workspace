import fs from 'node:fs/promises';
import path from 'node:path';

import { SKILLS_ROOT } from '../../scaffold/skills';

/**
 * What a task needs to read of the project's skills, by the files it writes: the cheatsheet for any part of
 * the space, the reference of the part it is — a layout, a component, data, a plugin, server code — and the run's
 * protocol always. The rest it reads when its work asks: a cold start reads a handful of files, not every skill.
 */

const AUTHORING = `${SKILLS_ROOT}/plitzi-authoring`;
const CLI = `${SKILLS_ROOT}/plitzi-cli`;

/** By what a path is: the files its task should read first. In order, without repeats, once matched. */
const READING: readonly { matches: (file: string) => boolean; read: readonly string[] }[] = [
  { matches: file => file.startsWith('src/space/'), read: [`${AUTHORING}/CHEATSHEET.md`] },
  {
    matches: file => /^src\/space\/(layout|layouts\/)/.test(file),
    read: [`${AUTHORING}/reference/layouts.md`]
  },
  { matches: file => file.startsWith('src/space/components/'), read: [`${AUTHORING}/reference/components.md`] },
  {
    matches: file => file.startsWith('src/data/') || file.startsWith('public/data/'),
    read: [`${AUTHORING}/reference/data-and-visibility.md`, `${AUTHORING}/reference/typed-sources.md`]
  },
  {
    matches: file => file.startsWith('src/plugins/'),
    read: [`${AUTHORING}/reference/plugins.md`, `${CLI}/reference/plugins.md`]
  },
  {
    matches: file => /^src\/(actions|functions|runtime)\//.test(file),
    read: [`${CLI}/reference/functions.md`]
  },
  { matches: file => /\.(test|spec)\.[cm]?ts$/.test(file), read: [`${AUTHORING}/reference/testing.md`] }
];

/**
 * What a designer reads once, before its first review of the others' UI: its half of the run — how it looks, measures
 * and says it — then what a reviewer looks for, and why.
 */
export const DESIGN_READING = [
  `${CLI}/reference/runs-designer.md`,
  `${AUTHORING}/reference/review-checklist.md`,
  `${AUTHORING}/reference/colours-and-motion.md`,
  `${AUTHORING}/reference/accessibility.md`
] as const;

const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    stat => stat.isFile(),
    () => false
  );

/** What a research card's scout reads first: its own half of the run. */
export const RESEARCH_READING = `${CLI}/reference/runs-scout.md`;

/**
 * The skill files a task writing `files` reads first — a research card its scout's half — only those the project has,
 * then the run's protocol.
 */
export const readingFor = async (
  root: string,
  files: readonly string[],
  { research = false }: { research?: boolean } = {}
): Promise<string[]> => {
  const wanted = [
    ...new Set([
      ...(research ? [RESEARCH_READING] : []),
      ...READING.filter(entry => files.some(entry.matches)).flatMap(entry => entry.read),
      `${CLI}/reference/runs.md`
    ])
  ];
  const found: string[] = [];
  for (const file of wanted) {
    if (await exists(path.join(root, file))) {
      found.push(file);
    }
  }

  return found;
};
