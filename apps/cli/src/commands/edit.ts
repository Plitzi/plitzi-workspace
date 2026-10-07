import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from './existingProject';
import { projectFormatter } from './projectFormatter';
import { AGAIN, noteRefused } from './repeats';
import { fail } from './terminal';
import { whereAnswer } from './where';
import { unifiedDiff } from '../fix/diff';
import { formatLikeBefore } from '../fix/format';
import { applyChanges, attributeEdit } from '../fix/sourceEdits';
import { loadTypeScript } from '../projectTypeScript';

import type { WhereAnswer } from './where';
import type { TextChange } from '../fix/sourceEdits';

/**
 * `plitzi edit <id>`: an element's attributes changed where the project's code writes it — the call `plitzi where`
 * finds — so a change of words or a setting needs no TypeScript written by hand. Written, formatted as the project
 * formats, and checked: the space is authored again in a fresh process, and unless every value asked for is there, the
 * file goes back to what it was.
 *
 *   plitzi edit hero-cta --set content="Start free"
 *   plitzi edit signup-email --set required=true --remove placeholder
 */

export interface EditOptions {
  set?: string[];
  remove?: string[];
  json?: boolean;
}

type Value = string | number | boolean;

interface Change {
  key: string;
  /** Absent: the attribute is removed. */
  value?: Value;
}

const run = promisify(execFile);

/** What `plitzi where --json` printed, read as its answer when it has the shape of one. */
const isWhereAnswer = (value: unknown): value is WhereAnswer => isRecord(value) && Array.isArray(value.matches);

/**
 * `--set key=value`, the value of the kind the attribute already has: a number stays a number, a boolean a boolean. A
 * new attribute is a boolean when it reads `true` or `false`, and words otherwise — never guessed to be a number.
 */
export const parseSets = (
  sets: readonly string[],
  current: Record<string, unknown>
): { changes: Change[] } | { problem: string } => {
  const changes: Change[] = [];
  for (const set of sets) {
    const at = set.indexOf('=');
    if (at <= 0) {
      return { problem: `\`--set ${set}\` is not key=value: write --set content="Start free"` };
    }

    const key = set.slice(0, at);
    const raw = set.slice(at + 1);
    const was = current[key];
    if (typeof was === 'number') {
      const value = Number(raw);
      if (raw.trim() === '' || Number.isNaN(value)) {
        return { problem: `\`${key}\` is a number: "${raw}" is not one` };
      }

      changes.push({ key, value });
      continue;
    }

    if (typeof was === 'boolean' || ((raw === 'true' || raw === 'false') && was === undefined)) {
      if (raw !== 'true' && raw !== 'false') {
        return { problem: `\`${key}\` is true or false: "${raw}" is neither` };
      }

      changes.push({ key, value: raw === 'true' });
      continue;
    }

    changes.push({ key, value: raw });
  }

  return { changes };
};

/** The element as the space authors it now, asked of a fresh process: the file was edited after this one loaded it. */
const authoredAfresh = async (elementId: string): Promise<WhereAnswer | { problem: string }> => {
  try {
    const { stdout } = await run(process.execPath, [process.argv[1], 'where', elementId, '--json'], {
      cwd: process.cwd(),
      maxBuffer: 16 * 1024 * 1024
    });
    const parsed: unknown = JSON.parse(stdout);

    return isWhereAnswer(parsed) ? parsed : { problem: 'the space did not answer' };
  } catch (error) {
    const printed = isRecord(error) && typeof error.stdout === 'string' ? error.stdout.trim() : '';

    return { problem: printed || (error instanceof Error ? error.message.split('\n')[0] : String(error)) };
  }
};

/** Why the edit did not land, read off the element as authored after it: nothing when every change is there. */
const missing = (after: WhereAnswer | { problem: string }, elementId: string, changes: readonly Change[]): string[] => {
  if ('problem' in after && !('matches' in after)) {
    return [`the space no longer authors: ${after.problem}`];
  }

  if (after.by === 'source') {
    return [`the space no longer authors: ${after.problem ?? 'it was refused'}`];
  }

  const element = after.matches.find(match => match.elementId === elementId);
  if (!element) {
    return [`\`${elementId}\` is no longer in the space`];
  }

  const attributes = element.attributes ?? {};

  return changes
    .filter(change => (change.value === undefined ? change.key in attributes : attributes[change.key] !== change.value))
    .map(change =>
      change.value === undefined
        ? `\`${change.key}\` is still set`
        : `\`${change.key}\` reads ${JSON.stringify(attributes[change.key])}, not ${JSON.stringify(change.value)}`
    );
};

export const edit = async (elementId: string, options: EditOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail('Run this in a project whose space is written in it (`src/space/`).');

    return;
  }

  // Refused again with the same arguments: the answer will not change, and the next attempt should not be this one.
  const refuse = async (problem: string): Promise<void> => {
    const command = ['edit', elementId, ...(options.set ?? []), ...(options.remove ?? []).map(key => `-${key}`)];
    const before = await noteRefused(project.root, command);
    fail(before > 0 ? `${problem}\n${AGAIN}` : problem);
  };

  if (!options.set?.length && !options.remove?.length) {
    await refuse('Say what to change: --set content="Start free", --remove placeholder.');

    return;
  }

  const found = await whereAnswer(project.root, elementId);
  if (found.by === 'source') {
    await refuse(
      `Nothing was changed: ${found.problem ?? 'the space does not author'}. Fix that first (\`npm run author\`).`
    );

    return;
  }

  const element = found.by === 'id' ? found.matches[0] : undefined;
  if (!element) {
    await refuse(
      `No element has the id "${elementId}". \`plitzi where ${elementId}\` finds it by a class or its words.`
    );

    return;
  }

  const { position } = element;
  const ts = loadTypeScript(project.root);
  if (!position || !ts) {
    await refuse(
      !position
        ? `\`${elementId}\` is not written by a call of the project (a page’s own root, or a part of a component): edit what holds it.`
        : 'The project has no TypeScript to read its source with: install its packages first.'
    );

    return;
  }

  const parsed = parseSets(options.set ?? [], element.attributes ?? {});
  if ('problem' in parsed) {
    await refuse(parsed.problem);

    return;
  }

  const changes: Change[] = [...parsed.changes, ...(options.remove ?? []).map(key => ({ key }))];
  const file = path.resolve(process.cwd(), position.file);
  const before = await fs.readFile(file, 'utf-8');
  const sourceFile = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits: TextChange[] = [];
  const unplaced: string[] = [];
  for (const change of changes) {
    const outcome = attributeEdit(ts, sourceFile, position, change.key, change.value);
    if ('unplaced' in outcome) {
      unplaced.push(`\`${change.key}\`: ${outcome.unplaced}`);
    } else {
      edits.push(...outcome.changes);
    }
  }

  const changed = unplaced.length === 0 ? applyChanges(before, edits) : undefined;
  if (changed === undefined) {
    await refuse(
      [
        `Nothing was changed in ${element.at}:`,
        ...(unplaced.length > 0 ? unplaced : ['two of the changes touch the same place']).map(line => `  - ${line}`),
        `Edit the call there by hand — \`plitzi where ${elementId}\` shows it.`
      ].join('\n')
    );

    return;
  }

  const after = await formatLikeBefore(await projectFormatter(project.root), position.file, before, changed);
  await fs.writeFile(file, after);
  const reasons = missing(await authoredAfresh(elementId), elementId, changes);
  if (reasons.length > 0) {
    await fs.writeFile(file, before);
    await refuse(
      ['Nothing was changed — the file is as it was:', ...reasons.map(reason => `  - ${reason}`)].join('\n')
    );

    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ elementId, at: element.at, changes }));

    return;
  }

  console.log(
    [
      unifiedDiff(path.relative(process.cwd(), file), before, after),
      chalk.green(
        `${elementId}: ${changes.map(change => change.key).join(', ')} written in ${element.at}; the space authors with it.`
      ),
      'Next: plitzi check — the page as it renders now'
    ].join('\n')
  );
};
