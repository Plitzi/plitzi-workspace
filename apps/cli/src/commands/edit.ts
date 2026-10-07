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
import { isReadings, readingOf, spaceEffects, surprises } from './spaceReading';
import { fail } from './terminal';
import { answerOf, locatedSpace } from './where';
import { unifiedDiff } from '../fix/diff';
import { formatLikeBefore } from '../fix/format';
import { applyChanges, listEntryBehind, listEntryEdit, parameterBehind, slotEdit, slotText } from '../fix/sourceEdits';
import { loadTypeScript } from '../projectTypeScript';

import type { AskedChange, ElementReading } from './spaceReading';
import type { WhereCall } from './where';
import type { ListEntryGiven, TextChange, ValueSlot } from '../fix/sourceEdits';
import type TypeScript from 'typescript';

/**
 * `plitzi edit <id>`: an element's attributes changed where the project's code writes it — the call `plitzi where`
 * finds — so a change of words or a setting needs no TypeScript written by hand. Written, formatted as the project
 * formats, and checked: the space is authored again in a fresh process and read against the one before — unless every
 * value asked for is there and nothing else changed, the files go back to what they were. What it changed is said,
 * every line of it.
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

type Change = AskedChange;

/** A file of the project as it was read, and the changes an edit makes to it. */
interface Source {
  file: string;
  before: string;
  sourceFile: TypeScript.SourceFile;
  edits: TextChange[];
}

/**
 * A change, and where it is made: the element's own call, one that hands a helper its value, or — when the call is
 * repeated over a list and reads an entry of it — that entry, in the file the list is written in.
 */
interface Placed {
  change: Change;
  call: WhereCall;
  slot: ValueSlot;
  entry?: { given: ListEntryGiven; file: string };
}

/** Where a placed change is said to be made. */
const placedAt = ({ call, entry }: Placed): string => (entry ? `${entry.file}, in ${entry.given.list}` : call.at);

/** The file a relative import names, as written or with the extension and index TypeScript would try. */
const importedFile = async (from: string, specifier: string): Promise<string | undefined> => {
  const base = path.join(path.dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    const found = await fs
      .stat(path.resolve(process.cwd(), candidate))
      .then(stat => stat.isFile())
      .catch(() => false);
    if (found) {
      return candidate;
    }
  }

  return undefined;
};

const run = promisify(execFile);

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

/** The space as it authors now, read by a fresh process: this one loaded the files before they were edited. */
const readAfresh = async (): Promise<ElementReading[] | { problem: string }> => {
  try {
    const { stdout } = await run(process.execPath, [process.argv[1], 'elements'], {
      cwd: process.cwd(),
      maxBuffer: 64 * 1024 * 1024
    });
    const parsed: unknown = JSON.parse(stdout);
    if (isReadings(parsed)) {
      return parsed;
    }

    return { problem: isRecord(parsed) && typeof parsed.problem === 'string' ? parsed.problem : 'it did not answer' };
  } catch (error) {
    const printed = isRecord(error) && typeof error.stdout === 'string' ? error.stdout.trim() : '';

    return { problem: printed || (error instanceof Error ? error.message.split('\n')[0] : String(error)) };
  }
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

  const located = await locatedSpace(project.root);
  if ('problem' in located) {
    await refuse(
      `Nothing was changed: the space does not author (${located.problem}). Fix that first (\`npm run author\`).`
    );

    return;
  }

  const found = await answerOf(project.root, located, elementId, 'id');

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
  // A bound attribute shows what its binding computes: a value written under it would change nothing on the page.
  const computed = changes.filter(change => element.bound?.includes(change.key));
  if (computed.length > 0) {
    await refuse(
      [
        `Nothing was changed: ${computed.map(change => `\`${change.key}\``).join(', ')} of ${elementId} is computed by a binding — the page shows the binding's value, never one written here.`,
        `Change the binding where it is written, by hand, at ${element.at ?? 'the call'} — \`plitzi where ${elementId} --by id\` shows it.`
      ].join('\n')
    );

    return;
  }

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
        const listed = listEntryBehind(ts, sourceFile, call.position, slot);
        if (!listed) {
          return { change, call, slot };
        }

        const file =
          listed.from === undefined ? call.position.file : await importedFile(call.position.file, listed.from);
        if (file === undefined || (listed.from !== undefined && !listed.from.startsWith('.'))) {
          return {
            unplaced: `\`${change.key}\` is \`${listed.key}\` of an entry of \`${listed.list}\`, which comes from ${listed.from ?? 'elsewhere'}`
          };
        }

        return { change, call, slot, entry: { given: listed, file } };
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
  // An entry of a list is this element's alone: only a change made in the call itself reaches the others.
  const shared = placed.filter(({ call, entry }) => call.sharedWith && !entry);
  if (shared.length > 0 && !options.every) {
    const said = await Promise.all(
      shared.map(async ({ change, call, slot }) => {
        const others = (call.sharedWith ?? []).join(', ');
        const written = slotText(ts, (await sourceOf(call.position.file)).sourceFile, call.position, slot);

        // Not a value there: `--every` would be refused too, so the way out is where the value comes from.
        return written && !written.literal
          ? {
              literal: false,
              line: `Nothing was changed: \`${change.key}\` is written as \`${written.text}\` in ${call.at}, the call that writes ${others} too — change it where \`${written.text}\` comes from.`
            }
          : {
              literal: true,
              line: `Nothing was changed: \`${change.key}\` is written in ${call.at}, which writes ${others} too — an edit there changes every one.`
            };
      })
    );
    await refuse(
      [
        ...said.map(({ line }) => line),
        ...(said.some(({ literal }) => literal)
          ? [
              `For all of them, add --every. For ${elementId} alone, hand it its own value where the helper is called, by hand — \`plitzi where ${elementId} --by id\` shows its own call.`
            ]
          : [])
      ].join('\n')
    );

    return;
  }

  for (const { change, call, slot, entry } of placed) {
    const source = await sourceOf(entry ? entry.file : call.position.file);
    const outcome = entry
      ? listEntryEdit(ts, source.sourceFile, entry.given, element.attributes?.[change.key], change.value)
      : slotEdit(ts, source.sourceFile, call.position, slot, change.value);
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

  // What it is asked to change: the element, and — with --every — each other element its shared calls write.
  const asked = new Map<string, Change[]>([[elementId, changes]]);
  for (const { change, call } of placed.filter(({ entry }) => !entry)) {
    for (const other of call.sharedWith ?? []) {
      asked.set(other, [...(asked.get(other) ?? []), change]);
    }
  }

  const after = await readAfresh();
  const effects = 'problem' in after ? [] : spaceEffects(located.map(readingOf), after);
  const reasons =
    'problem' in after ? [`the space no longer authors: ${after.problem}`] : surprises(effects, after, asked);
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

  if (options.json) {
    console.log(
      JSON.stringify({
        elementId,
        changes: placed.map(one => ({ ...one.change, at: placedAt(one) })),
        effects: effects.map(effect => effect.line)
      })
    );

    return;
  }

  console.log(
    [
      ...written.map(({ file, before, after }) => unifiedDiff(file, before, after)),
      chalk.green(
        `${elementId}: ${placed.map(one => `${one.change.key} in ${placedAt(one)}`).join(', ')}; the space authors with it.`
      ),
      'Changed in the space:',
      ...effects.map(effect => `  ${effect.line}`),
      'Next: plitzi check — the page as it renders now'
    ].join('\n')
  );
};
