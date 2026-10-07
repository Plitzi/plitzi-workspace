import fs from 'node:fs/promises';
import path from 'node:path';

import { authorSpace, refusalOf } from '@plitzi/sdk-authoring';

import { finding } from './catalog';
import { loadProjectSpace } from '../commands/projectSpace';

import type { LintFinding } from './types';
import type { Suggestion } from '@plitzi/sdk-authoring';
import type { ProjectSpaceSource } from '@plitzi/sdk-authoring/node';

const AT = /^(.+):(\d+)$/;

// `colour-not-token` reports every colour the source writes out, at its line: authoring's `literal-colour` would only
// say some of them again, with none.
const NOT_RELAYED: ReadonlySet<string> = new Set(['literal-colour']);

/** What a refusal says first, in a line: its heading and the first problem under it — `npm run author` says the rest. */
const firstLines = (error: unknown): string =>
  refusalOf(error)
    .message.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

/**
 * Where a suggestion's element was written, relative to the root: authoring says it relative to the working directory
 * the space was authored in, and a file reached through a link (`/var` → `/private/var`) by where it is.
 */
const placeOf = async (root: string, at: string | undefined): Promise<{ file: string; line: number } | undefined> => {
  const match = at === undefined ? null : AT.exec(at);
  if (!match) {
    return undefined;
  }

  const written = path.resolve(process.cwd(), match[1]);
  const file = await fs.realpath(written).catch(() => written);

  return { file: path.relative(root, file), line: Number(match[2]) };
};

/**
 * A suggestion as a finding, whatever its code: authoring owns the codes and what they say, and a code it adds is
 * relayed the day it is added. Its docs are `plitzi explain <code>`, which reads the same catalogue.
 */
const fromSuggestion = async (root: string, suggestion: Suggestion): Promise<LintFinding> => {
  const place = await placeOf(root, suggestion.at);

  return {
    code: suggestion.code,
    severity: 'warning',
    origin: 'authoring',
    message: suggestion.message,
    ...(place ? { file: place.file, line: place.line, column: 1 } : {}),
    docs: `npx plitzi explain ${suggestion.code}`
  };
};

/**
 * What authoring suggests about the space the source authors to — a layout for a header on every page, a component for
 * cards written ten times, a class nothing wears — read as `npm run author` reads it, at the line that wrote each.
 * Its warnings and refusals are not relayed: whether the space is valid is `npm run author`'s to say.
 */
export const authoringFindings = async (root: string): Promise<LintFinding[]> => {
  let project: ProjectSpaceSource | { problem: string };
  try {
    project = await loadProjectSpace(root);
  } catch (error) {
    return [
      finding(
        'space-does-not-author',
        `The space could not be loaded, so what authoring suggests about it could not be read — \`npm run author\` says why: ${firstLines(error)}`
      )
    ];
  }

  if ('problem' in project) {
    return [finding('space-does-not-author', `${project.problem} What authoring suggests could not be read.`)];
  }

  let suggestions: Suggestion[];
  try {
    suggestions = authorSpace(project.space, project.authoring).suggestions;
  } catch (error) {
    return [
      finding(
        'space-does-not-author',
        `The space does not author, so what authoring suggests about it could not be read — \`npm run author\` says why: ${firstLines(error)}`
      )
    ];
  }

  return Promise.all(
    suggestions
      .filter(suggestion => !NOT_RELAYED.has(suggestion.code))
      .map(suggestion => fromSuggestion(root, suggestion))
  );
};
