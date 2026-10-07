import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { findProject } from './existingProject';
import { filesUnder } from './filesUnder';
import { projectFormatter } from './projectFormatter';
import { AGAIN, noteRefused } from './repeats';
import { effectLines, readAfresh, readingOf, spaceEffects } from './spaceReading';
import { fail } from './terminal';
import { answerOf, locatedSpace } from './where';
import { unifiedDiff } from '../fix/diff';
import { formatLikeBefore } from '../fix/format';
import {
  applyChanges,
  callsNamed,
  listItemAt,
  moveItem,
  namesIn,
  pruneDeclarations,
  pruneImports,
  removeItem
} from '../fix/sourceEdits';
import { loadTypeScript } from '../projectTypeScript';

import type { ElementReading, SpaceEffect } from './spaceReading';
import type { WhereAnswer } from './where';
import type { EditOutcome } from '../fix/sourceEdits';
import type { WrittenElement, WrittenPosition } from '@plitzi/sdk-authoring';

/**
 * `plitzi element remove <id>` and `plitzi element move <id> --before|--after <id>`: an element taken out of the code that writes it,
 * or put elsewhere among its siblings — the call, not a line of TypeScript written by hand. Checked as `edit` checks:
 * the space authored again in a fresh process and read against the one before. A removal may only take the element
 * and what it holds, a move may only reorder its parent; anything else and the file goes back, what it would have
 * changed named.
 *
 *   plitzi element remove ent-trust
 *   plitzi element move ent-faq --before ent-contact
 */

export interface RemoveOptions {
  json?: boolean;
}

export interface MoveOptions {
  before?: string;
  after?: string;
  json?: boolean;
}

type Element = WhereAnswer['matches'][number];

interface Located {
  root: string;
  elements: WrittenElement[];
  element: Element;
  ts: NonNullable<ReturnType<typeof loadTypeScript>>;
  position: NonNullable<Element['position']>;
  refuse: (problem: string) => Promise<void>;
}

/** The element asked for, where its call is written — or the refusal already said, and nothing. */
const locate = async (elementId: string, command: string[]): Promise<Located | undefined> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail('Run this in a project whose space is written in it (`src/space/`).');

    return undefined;
  }

  // Refused again with the same arguments: the answer will not change, and the next attempt should not be this one.
  const refuse = async (problem: string): Promise<void> => {
    const before = await noteRefused(project.root, command);
    fail(before > 0 ? `${problem}\n${AGAIN}` : problem);
  };

  const elements = await locatedSpace(project.root);
  if ('problem' in elements) {
    await refuse(`Nothing was changed: the space does not author (${elements.problem}). Fix that first.`);

    return undefined;
  }

  const found = await answerOf(project.root, elements, elementId, 'id');
  const element = found.matches.at(0);
  const ts = loadTypeScript(project.root);
  if (!element || !ts) {
    await refuse(
      element
        ? 'The project has no TypeScript to read its source with: install its packages first.'
        : found.nearest
          ? `No element has the id "${elementId}" — did you mean ${found.nearest}?`
          : `No element has the id "${elementId}". \`plitzi element where ${elementId}\` finds it by a class or its words.`
    );

    return undefined;
  }

  const { position } = element;
  if (!position || element.elementId === element.rootId) {
    await refuse(
      element.elementId === element.rootId
        ? `\`${elementId}\` is a page or a layout: it is taken out of, or moved in, the space's \`pages\` or \`layouts\` by hand.`
        : `\`${elementId}\` is not written by a call of the project (a part of a component): change what holds it.`
    );

    return undefined;
  }

  // A call written once for many elements: taking it out, or moving it, takes or moves every one.
  if (element.sharedWith) {
    await refuse(
      `Nothing was changed: ${element.at ?? 'the call'} writes ${element.sharedWith.join(', ')} too — by hand, or change the list it is repeated for${element.repeatedFor ? ` (${element.repeatedFor.list})` : ''}.`
    );

    return undefined;
  }

  return { root: project.root, elements, element, ts, position, refuse };
};

const parse = async (ts: Located['ts'], file: string) =>
  ts.createSourceFile(
    file,
    await fs.readFile(path.resolve(process.cwd(), file), 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

/**
 * Where an element is an item of a list of children: its own call, or — a section a helper returns — the call of the
 * helper, followed up the calls that led to it. `via` names the helper when there is one.
 */
const itemOf = async (
  ts: Located['ts'],
  element: Element
): Promise<{ position: WrittenPosition; via?: string } | { problem: string }> => {
  const chain = [
    ...(element.position ? [element.position] : []),
    ...(element.through ?? []).map(call => call.position)
  ];
  let via: string | undefined;
  for (const position of chain) {
    const sourceFile = await parse(ts, position.file);
    if (via !== undefined && !callsNamed(ts, sourceFile, position, via)) {
      return { problem: `\`${via}\` returns it, and is not called where it was` };
    }

    const at = listItemAt(ts, sourceFile, position);
    if (at === 'item') {
      return { position, ...(via === undefined ? {} : { via }) };
    }

    if ('unplaced' in at) {
      return { problem: at.unplaced };
    }

    via = at.returnedBy;
  }

  return { problem: `\`${via ?? 'its call'}\` returns it, and no call of the project hands it to a list` };
};

/** Whether nothing in the project's `src/` reads a name but where it is declared: a helper a removal left behind. */
const readByNone = async (root: string, name: string): Promise<boolean> => {
  const word = new RegExp(`\\b${name}\\b`, 'g');
  let reads = 0;
  for (const file of (await filesUnder(root, 'src')).filter(each => /\.tsx?$/.test(each))) {
    reads += (await fs.readFile(path.join(root, file), 'utf-8')).match(word)?.length ?? 0;
  }

  return reads <= 1;
};

/**
 * The file written with an edit, formatted as the project formats, and the space read again: what changed, or — when
 * the space no longer authors, or `expected` says the change is not what was meant — the file put back and why.
 */
const writeAndRead = async (
  located: Located,
  file: string,
  before: string,
  edited: string,
  expected: (effects: SpaceEffect[], after: ElementReading[]) => string[]
): Promise<{ after: string; effects: SpaceEffect[]; lines: string[] } | undefined> => {
  const absolute = path.resolve(process.cwd(), file);
  const after = await formatLikeBefore(await projectFormatter(located.root), file, before, edited);
  await fs.writeFile(absolute, after);
  const read = await readAfresh();
  const effects = 'problem' in read ? [] : spaceEffects(located.elements.map(readingOf), read);
  const reasons = 'problem' in read ? [`the space no longer authors: ${read.problem}`] : expected(effects, read);
  if (reasons.length > 0) {
    await fs.writeFile(absolute, before);
    await located.refuse(
      ['Nothing was changed — the file is as it was:', ...reasons.map(reason => `  - ${reason}`)].join('\n')
    );

    return undefined;
  }

  return {
    after,
    effects,
    lines: 'problem' in read ? [] : effectLines(effects, located.elements.map(readingOf), read)
  };
};

const said = (outcome: EditOutcome, before: string): string | { problem: string } => {
  if ('unplaced' in outcome) {
    return { problem: outcome.unplaced };
  }

  return applyChanges(before, outcome.changes) ?? { problem: 'two of the changes touch the same place' };
};

/** The element and everything it holds, by id. */
export const subtreeOf = (elements: readonly WrittenElement[], elementId: string): Set<string> => {
  const byId = new Map(elements.map(element => [element.elementId, element]));
  const ids = new Set<string>();
  const walk = (id: string): void => {
    if (ids.has(id)) {
      return;
    }

    ids.add(id);
    byId.get(id)?.children.forEach(walk);
  };
  walk(elementId);

  return ids;
};

/**
 * The steps of other elements that act on what a removal would take away — a button that opens the modal — each with
 * where it is written: what the removal would leave pointing at nothing.
 */
export const pointedAt = (elements: readonly WrittenElement[], gone: ReadonlySet<string>): string[] => {
  // Two flows doing the same — a click and a key that open one modal — are one line, said with how many.
  const counted = new Map<string, number>();
  for (const element of elements.filter(each => !gone.has(each.elementId))) {
    for (const target of element.targets.filter(each => gone.has(each.elementId))) {
      const line = `${element.elementId} ${target.step} → ${target.elementId}${element.at ? ` (${element.at})` : ''}`;
      counted.set(line, (counted.get(line) ?? 0) + 1);
    }
  }

  return [...counted].map(([line, times]) => (times > 1 ? `${line}, in ${String(times)} flows` : line));
};

/** Only the element and what it holds may go, and its parent lose it: anything else is named. */
export const removalSurprises = (elementId: string, effects: readonly SpaceEffect[]): string[] => [
  ...(effects.some(effect => effect.kind === 'removed' && effect.elementId === elementId)
    ? []
    : [`${elementId} is still in the space`]),
  ...effects
    .filter(effect => effect.kind !== 'removed' && !(effect.kind === 'field' && effect.field === 'children'))
    .map(effect => `it changed ${effect.line} too, which was not asked`)
];

/** Only its parent's order may change, and the element must end up beside the one it was moved by. */
export const moveSurprises = (
  elementId: string,
  sibling: string,
  side: 'before' | 'after',
  effects: readonly SpaceEffect[],
  after: readonly ElementReading[]
): string[] => {
  const parent = after.find(reading => reading.children.includes(elementId));
  const at = parent ? parent.children.indexOf(elementId) : -1;
  const by = parent ? parent.children.indexOf(sibling) : -1;
  const placed = side === 'before' ? at + 1 === by : at - 1 === by;

  return [
    ...(placed && at !== -1 ? [] : [`${elementId} is not ${side} ${sibling} in the space`]),
    ...effects
      .filter(effect => !(effect.kind === 'field' && effect.field === 'children'))
      .map(effect => `it changed ${effect.line} too, which was not asked`)
  ];
};

export const remove = async (elementId: string, options: RemoveOptions): Promise<void> => {
  const located = await locate(elementId, ['remove', elementId]);
  if (!located) {
    return;
  }

  const { ts, element } = located;
  const item = await itemOf(ts, element);
  if ('problem' in item) {
    await located.refuse(`Nothing was changed in ${element.at ?? 'its file'}: ${item.problem}.`);

    return;
  }

  // Said before anything is written: a removal that leaves a step pointed at nothing is not one to make and undo.
  const pointing = pointedAt(located.elements, subtreeOf(located.elements, elementId));
  if (pointing.length > 0) {
    await located.refuse(
      [
        `Nothing was changed: other elements' flows act on what removing ${elementId} takes away:`,
        ...pointing.map(line => `  - ${line}`),
        'Take those steps out, or point them at another element, first — then remove it.'
      ].join('\n')
    );

    return;
  }

  const file = item.position.file;
  const before = await fs.readFile(path.resolve(process.cwd(), file), 'utf-8');
  const sourceFile = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const outcome = removeItem(ts, sourceFile, item.position);
  const without = said(outcome, before);
  if (typeof without !== 'string') {
    await located.refuse(`Nothing was changed in ${element.at ?? file}: ${without.problem}.`);

    return;
  }

  // What only the removed call read goes with it, and is named: a style declared for it, the imports of its factories.
  const names = 'removed' in outcome && outcome.removed ? namesIn(ts, outcome.removed) : [];
  const declarations = pruneDeclarations(ts, file, without, names);
  const edited = pruneImports(ts, file, declarations.text, names);
  const importsGone = names.filter(name => importsName(ts, declarations.text, name) && !importsName(ts, edited, name));
  const written = await writeAndRead(located, file, before, edited, effects => removalSurprises(elementId, effects));
  if (!written) {
    return;
  }

  const gone = [
    ...declarations.pruned.map(name => `styles ${name}`),
    ...importsGone.map(name => `the import of ${name}`)
  ];
  // The helper it was built by stays where it is declared — another file, maybe kept for later — and is said if unread.
  const helperUnread = item.via !== undefined && (await readByNone(located.root, item.via)) ? item.via : undefined;
  if (options.json) {
    console.log(
      JSON.stringify({
        elementId,
        at: `${file}:${String(item.position.line)}`,
        effects: written.lines,
        unused: gone,
        ...(helperUnread ? { unreadHelper: helperUnread } : {})
      })
    );

    return;
  }

  console.log(
    [
      unifiedDiff(file, before, written.after),
      chalk.green(
        `${elementId} removed${item.via ? ` — the call of ${item.via} that builds it —` : ''} from ${file}:${String(item.position.line)}; the space authors without it.`
      ),
      'Changed in the space:',
      ...written.lines.map(line => `  ${line}`),
      ...(gone.length > 0 ? [`Taken out too, nothing reads them any longer: ${gone.join(', ')}.`] : []),
      ...(helperUnread
        ? [`${helperUnread} is read by nothing now: delete it where it is declared, unless it is kept for later.`]
        : []),
      'Next: plitzi verify — or plitzi page check the page it was on'
    ].join('\n')
  );
};

/** Whether a file imports a name, by any of its import declarations. */
const importsName = (ts: NonNullable<ReturnType<typeof loadTypeScript>>, text: string, name: string): boolean => {
  const sourceFile = ts.createSourceFile('file.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  return sourceFile.statements.some(statement => {
    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;

    return !!bindings && ts.isNamedImports(bindings) && bindings.elements.some(binding => binding.name.text === name);
  });
};

export const move = async (elementId: string, options: MoveOptions): Promise<void> => {
  const side = options.before ? 'before' : options.after ? 'after' : undefined;
  const siblingId = options.before ?? options.after;
  if (!side || !siblingId || (options.before && options.after)) {
    fail('Say where it goes, one way: --before <id> or --after <id> — an element of the same list of children.');

    return;
  }

  if (siblingId === elementId) {
    fail(`${elementId} beside itself is where it already is: --before or --after names another element of its list.`);

    return;
  }

  const located = await locate(elementId, ['move', elementId, side, siblingId]);
  if (!located) {
    return;
  }

  const { ts, element } = located;
  const siblingFound = await answerOf(located.root, located.elements, siblingId, 'id');
  const sibling = siblingFound.matches.at(0);
  if (!sibling) {
    await located.refuse(
      `No element has the id "${siblingId}"${siblingFound.nearest ? ` — did you mean ${siblingFound.nearest}?` : '.'}`
    );

    return;
  }

  const item = await itemOf(ts, element);
  const by = await itemOf(ts, sibling);
  if ('problem' in item || 'problem' in by) {
    await located.refuse(
      `Nothing was changed: ${'problem' in item ? `${elementId}: ${item.problem}` : `${siblingId}: ${'problem' in by ? by.problem : ''}`}.`
    );

    return;
  }

  if (item.position.file !== by.position.file) {
    await located.refuse(
      `Nothing was changed: ${elementId} is an item in ${item.position.file}, ${siblingId} in ${by.position.file} — a move between files is by hand.`
    );

    return;
  }

  const file = item.position.file;
  const before = await fs.readFile(path.resolve(process.cwd(), file), 'utf-8');
  const sourceFile = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edited = said(moveItem(ts, sourceFile, item.position, by.position, side), before);
  if (typeof edited !== 'string') {
    await located.refuse(`Nothing was changed in ${element.at ?? file}: ${edited.problem}.`);

    return;
  }

  const written = await writeAndRead(located, file, before, edited, (effects, after) =>
    moveSurprises(elementId, siblingId, side, effects, after)
  );
  if (!written) {
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ elementId, side, sibling: siblingId, effects: written.lines }));

    return;
  }

  console.log(
    [
      unifiedDiff(file, before, written.after),
      chalk.green(`${elementId} moved ${side} ${siblingId}; the space authors with it.`),
      'Changed in the space:',
      ...written.lines.map(line => `  ${line}`),
      'Next: plitzi page check the page it is on'
    ].join('\n')
  );
};
