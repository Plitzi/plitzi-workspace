import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';

import { closest } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from './existingProject';
import { projectFormatter } from './projectFormatter';
import { AGAIN, noteRefused } from './repeats';
import { fail } from './terminal';
import { whereAnswer } from './where';
import { unifiedDiff } from '../fix/diff';
import { formatLikeBefore } from '../fix/format';
import { applyChanges, parameterBehind, slotEdit } from '../fix/sourceEdits';
import { loadTypeScript } from '../projectTypeScript';

import type { WhereAnswer, WhereCall } from './where';
import type { TextChange, ValueSlot } from '../fix/sourceEdits';
import type TypeScript from 'typescript';

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
  /** The call writes other elements too — a helper called more than once — and the change is meant for every one. */
  every?: boolean;
  json?: boolean;
}

type Value = string | number | boolean;

interface Change {
  key: string;
  /** Absent: the attribute is removed. */
  value?: Value;
}

/** A file of the project as it was read, and the changes an edit makes to it. */
interface Source {
  file: string;
  before: string;
  sourceFile: TypeScript.SourceFile;
  edits: TextChange[];
}

/** A change, and the call it is made in: the element's own, or one that hands a helper its value. */
interface Placed {
  change: Change;
  call: WhereCall;
  slot: ValueSlot;
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
    const { stdout } = await run(process.execPath, [process.argv[1], 'where', elementId, '--by', 'id', '--json'], {
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

  const found = await whereAnswer(project.root, elementId, 'id');
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
  // Only what the element has as an attribute: an option of the factory that wrote it (`as`, `from`) is how the call
  // builds the element, not one of its attributes, and an edit of it could not be checked — said before anything is.
  const attributes = Object.keys(element.attributes ?? {});
  const unknown = changes.filter(change => !attributes.includes(change.key));
  if (unknown.length > 0) {
    await refuse(
      [
        `Nothing was changed: a ${element.type} has no attribute ${unknown
          .map(change => {
            const nearest = closest(change.key, attributes);

            return `\`${change.key}\`${nearest ? ` (did you mean \`${nearest}\`?)` : ''}`;
          })
          .join(', ')}. It has ${attributes.join(', ')}.`,
        `What the call is written with besides its attributes is edited by hand, at ${element.at ?? 'the call'} — \`plitzi where ${elementId} --by id\` shows it.`
      ].join('\n')
    );

    return;
  }

  const sources = new Map<string, Source>();
  const sourceOf = async (file: string): Promise<Source> => {
    const known = sources.get(file);
    if (known) {
      return known;
    }

    const at = path.resolve(process.cwd(), file);
    const before = await fs.readFile(at, 'utf-8');
    const source = {
      file,
      before,
      sourceFile: ts.createSourceFile(at, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
      edits: []
    };
    sources.set(file, source);

    return source;
  };

  const calls: WhereCall[] = [
    { at: element.at ?? position.file, position, ...(element.sharedWith ? { sharedWith: element.sharedWith } : {}) },
    ...(element.through ?? [])
  ];
  // Where each change is made: the element's own call, or — when it is written there as a helper's parameter — where
  // the helper is handed it, followed up as far as the project's code hands it on.
  const place = async (change: Change): Promise<Placed | { unplaced: string }> => {
    let slot: ValueSlot = { attribute: change.key };
    for (const [depth, call] of calls.entries()) {
      const { sourceFile } = await sourceOf(call.position.file);
      const given = parameterBehind(ts, sourceFile, call.position, slot);
      if (!given) {
        return { change, call, slot };
      }

      if (given.uses > 1) {
        return {
          unplaced: `\`${change.key}\` is \`${given.name}\` there, which \`${given.slot.helper}\` reads ${String(given.uses)} times: what it is handed is more than ${elementId}’s \`${change.key}\``
        };
      }

      if (depth === calls.length - 1) {
        return {
          unplaced: `\`${change.key}\` is \`${given.name}\` there, and no call of the project hands it to \`${given.slot.helper}\``
        };
      }

      slot = given.slot;
    }

    return { unplaced: 'the call that wrote it is not where it was' };
  };

  const placed: Placed[] = [];
  const unplaced: string[] = [];
  for (const change of changes) {
    const outcome = await place(change);
    if ('unplaced' in outcome) {
      unplaced.push(`\`${change.key}\`: ${outcome.unplaced}`);
    } else {
      placed.push(outcome);
    }
  }

  // A call that writes more than one element changes them all: never done unasked, the agent would not know it had.
  const shared = placed.filter(({ call }) => call.sharedWith);
  if (shared.length > 0 && !options.every) {
    await refuse(
      [
        ...shared.map(
          ({ change, call }) =>
            `Nothing was changed: \`${change.key}\` is written in ${call.at}, which writes ${(call.sharedWith ?? []).join(', ')} too — an edit there changes every one.`
        ),
        `For all of them, add --every. For ${elementId} alone, hand it its own value where the helper is called, by hand — \`plitzi where ${elementId} --by id\` shows its own call.`
      ].join('\n')
    );

    return;
  }

  for (const { change, call, slot } of placed) {
    const source = await sourceOf(call.position.file);
    const outcome = slotEdit(ts, source.sourceFile, call.position, slot, change.value);
    if ('unplaced' in outcome) {
      unplaced.push(`\`${change.key}\`: ${outcome.unplaced}`);
    } else {
      source.edits.push(...outcome.changes);
    }
  }

  const changed = [...sources.values()]
    .filter(source => source.edits.length > 0)
    .map(source => ({ source, after: unplaced.length === 0 ? applyChanges(source.before, source.edits) : undefined }));
  if (unplaced.length > 0 || changed.some(({ after }) => after === undefined)) {
    await refuse(
      [
        `Nothing was changed in ${element.at}:`,
        ...(unplaced.length > 0 ? unplaced : ['two of the changes touch the same place']).map(line => `  - ${line}`),
        `Edit the call there by hand — \`plitzi where ${elementId} --by id\` shows it.`
      ].join('\n')
    );

    return;
  }

  const formatter = await projectFormatter(project.root);
  const written: { file: string; before: string; after: string }[] = [];
  for (const { source, after } of changed) {
    if (after !== undefined) {
      const formatted = await formatLikeBefore(formatter, source.file, source.before, after);
      await fs.writeFile(path.resolve(process.cwd(), source.file), formatted);
      written.push({ file: source.file, before: source.before, after: formatted });
    }
  }

  const reasons = missing(await authoredAfresh(elementId), elementId, changes);
  if (reasons.length > 0) {
    await Promise.all(written.map(({ file, before }) => fs.writeFile(path.resolve(process.cwd(), file), before)));
    await refuse(
      [
        `Nothing was changed — ${written.length > 1 ? 'the files are' : 'the file is'} as it was:`,
        ...reasons.map(reason => `  - ${reason}`)
      ].join('\n')
    );

    return;
  }

  const alsoChanged = [...new Set(placed.flatMap(({ call }) => call.sharedWith ?? []))];
  if (options.json) {
    console.log(
      JSON.stringify({
        elementId,
        changes: placed.map(({ change, call }) => ({ ...change, at: call.at })),
        ...(alsoChanged.length > 0 ? { alsoChanged } : {})
      })
    );

    return;
  }

  console.log(
    [
      ...written.map(({ file, before, after }) => unifiedDiff(file, before, after)),
      chalk.green(
        `${elementId}: ${placed.map(({ change, call }) => `${change.key} in ${call.at}`).join(', ')}; the space authors with it.`
      ),
      ...(alsoChanged.length > 0 ? [`The same call writes ${alsoChanged.join(', ')}: changed too.`] : []),
      'Next: plitzi check — the page as it renders now'
    ].join('\n')
  );
};
