import fs from 'node:fs/promises';
import path from 'node:path';

import { locateElements, refusalOf } from '@plitzi/sdk-authoring';

import { findProject } from './existingProject';
import { filesUnder } from './filesUnder';
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { callTextAt } from '../fix/sourceEdits';
import { loadTypeScript } from '../projectTypeScript';

import type { WrittenElement, WrittenPosition } from '@plitzi/sdk-authoring';

/**
 * `plitzi where <id | class | words>`: where the project's code writes an element — the file, the line and the call
 * itself — so an agent edits that call instead of reading the files around it. Asked of the code as it is NOW (the space
 * authored again, each element's call site read back), so it follows an element wherever a person moved it; nothing is
 * kept that could fall out of step.
 *
 *   plitzi where hero-cta          # by id
 *   plitzi where navLink           # every element wearing the class
 *   plitzi where "Get started"     # every element showing the words
 */

/** The three readings of a query, in the order a bare one is tried. */
export const WHERE_READINGS = ['id', 'class', 'text'] as const;

export type WhereReading = (typeof WHERE_READINGS)[number];

export interface WhereOptions {
  /** Read the query one way only, instead of the first that matches. */
  by?: WhereReading;
  json?: boolean;
}

/** How a query found what it names. */
type WhereBy = WhereReading | 'source';

interface WhereMatch {
  elementId: string;
  type: string;
  rootId: string;
  classes: string[];
  content?: string;
  at?: string;
  /** The same place exactly: the factory's name, at its line and column — what `plitzi edit` edits at. */
  position?: WrittenPosition;
  /** The call that writes it, as written — cut after `SNIPPET_LINES` lines. */
  code?: string;
  /** Its attributes as authored: only when the query named it by id. */
  attributes?: Record<string, unknown>;
  /** The attributes a binding computes: the page shows the binding's value, never the one written. */
  bound?: string[];
  /** The other elements the same call writes — a helper called more than once: an edit there changes every one. */
  sharedWith?: string[];
  /**
   * Only by id: the calls of the project's code that led to that one, the nearest first, each with the elements of
   * `sharedWith` it leads to as well — what `plitzi edit` follows a helper's parameter up.
   */
  through?: WhereCall[];
  /** When the call writes other elements too: the nearest call that leads to this one alone, as it is written. */
  ownCall?: { at: string; code?: string };
}

export interface WhereCall {
  at: string;
  position: WrittenPosition;
  sharedWith?: string[];
}

export interface WhereAnswer {
  query: string;
  by?: WhereBy;
  matches: WhereMatch[];
  /** Matches past the first `MATCHES`, left out. */
  more?: number;
  /** The other readings the query matched too, by how many — a query that means two things says so. */
  also?: { by: WhereReading; count: number }[];
  /** Lines of `src/` holding the words, when the space could not be authored to find the element. */
  lines?: { at: string; text: string }[];
  problem?: string;
}

const MATCHES = 10;

const SNIPPETS = 3;

const SNIPPET_LINES = 12;

/** A name as compared: `nav-link`, `navLink` and `nav_link` are one. */
const comparable = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Every element a query names when it is read one way. */
const readAs = (elements: readonly WrittenElement[], query: string, reading: WhereReading): WrittenElement[] => {
  if (reading === 'id') {
    return elements.filter(element => element.elementId === query);
  }

  if (reading === 'class') {
    // A class is asked for by its name (`nav-link`) or by the variable that holds it in the code (`navLink`).
    const className = comparable(query);

    return elements.filter(element => element.classes.some(name => comparable(name) === className));
  }

  const words = query.toLowerCase();

  // The words it shows: its own, or the ones a binding's template writes (`'Reading as a guest'` inside a ternary).
  return elements.filter(
    element =>
      element.content?.toLowerCase().includes(words) ||
      element.templates.some(template => template.toLowerCase().includes(words))
  );
};

/**
 * What a query names: read the one way asked, or the first of an id, a class and words that matches — and the other
 * readings that matched too, said with their counts, so a query that means two things is never answered as one.
 */
export const matchElements = (
  elements: readonly WrittenElement[],
  query: string,
  by?: WhereReading
): { by: WhereReading; found: WrittenElement[]; also: { by: WhereReading; count: number }[] } | undefined => {
  const readings = WHERE_READINGS.filter(reading => by === undefined || reading === by)
    .map(reading => ({ by: reading, found: readAs(elements, query, reading) }))
    .filter(reading => reading.found.length > 0);
  if (readings.length === 0) {
    return undefined;
  }

  const [first, ...others] = readings;

  return { by: first.by, found: first.found, also: others.map(other => ({ by: other.by, count: other.found.length })) };
};

/** The call as written, its lines brought back to the column it starts at and cut after `SNIPPET_LINES`. */
const snippet = (code: string): string => {
  const [first, ...rest] = code.split('\n');
  const indents = rest.filter(line => line.trim() !== '').map(line => line.length - line.trimStart().length);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  const lines = [first, ...rest.map(line => line.slice(indent))];

  return lines.length > SNIPPET_LINES ? [...lines.slice(0, SNIPPET_LINES), '  …'].join('\n') : lines.join('\n');
};

/** Each match with the call that writes it, read from the file the position names. */
const positionKey = (position: WrittenPosition): string =>
  `${position.file}:${String(position.line)}:${String(position.column)}`;

const atOf = (position: WrittenPosition): string => `${position.file}:${String(position.line)}`;

/** Every element by the call that writes it: more than one under a key is a helper called more than once. */
export const byCall = (elements: readonly WrittenElement[]): Map<string, WrittenElement[]> => {
  const calls = new Map<string, WrittenElement[]>();
  for (const element of elements) {
    if (element.position) {
      const key = positionKey(element.position);
      calls.set(key, [...(calls.get(key) ?? []), element]);
    }
  }

  return calls;
};

/** The calls that led to an element's own, each with the other elements written by the same call it leads to too. */
export const callsThrough = (element: WrittenElement, sharers: readonly WrittenElement[]): WhereCall[] =>
  element.through.map(position => {
    const key = positionKey(position);
    const sharedWith = sharers
      .filter(sharer => sharer.through.some(call => positionKey(call) === key))
      .map(sharer => sharer.elementId);

    return { at: atOf(position), position, ...(sharedWith.length > 0 ? { sharedWith } : {}) };
  });

const codeAt = async (ts: NonNullable<ReturnType<typeof loadTypeScript>>, position: WrittenPosition) => {
  const file = path.resolve(process.cwd(), position.file);
  const text = await fs.readFile(file, 'utf-8').catch(() => undefined);

  return text === undefined
    ? undefined
    : callTextAt(ts, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), position);
};

const withCode = async (
  root: string,
  found: readonly WrittenElement[],
  by: WhereBy,
  calls: ReadonlyMap<string, WrittenElement[]>
): Promise<WhereMatch[]> => {
  const ts = loadTypeScript(root);
  const shown = found.slice(0, MATCHES);

  return Promise.all(
    shown.map(async (element, index) => {
      const { elementId, type, rootId, classes, content, at, position, attributes, bound } = element;
      const match: WhereMatch = {
        elementId,
        type,
        rootId,
        classes,
        ...(content === undefined ? {} : { content }),
        ...(at === undefined ? {} : { at }),
        ...(position ? { position } : {}),
        ...(by === 'id' ? { attributes } : {}),
        ...(bound.length > 0 ? { bound } : {})
      };
      const sharers = position
        ? (calls.get(positionKey(position)) ?? []).filter(other => other.elementId !== elementId)
        : [];
      const through = callsThrough(element, sharers);
      if (by === 'id' && through.length > 0) {
        match.through = through;
      }

      const own = sharers.length > 0 ? through.find(call => !call.sharedWith) : undefined;
      if (sharers.length > 0) {
        match.sharedWith = sharers.map(sharer => sharer.elementId);
      }

      if (!ts || !position || index >= SNIPPETS) {
        return own ? { ...match, ownCall: { at: own.at } } : match;
      }

      const code = await codeAt(ts, position);
      const ownCode = own && (await codeAt(ts, own.position));

      return {
        ...match,
        ...(code === undefined ? {} : { code: snippet(code) }),
        ...(own ? { ownCall: { at: own.at, ...(ownCode === undefined ? {} : { code: snippet(ownCode) }) } } : {})
      };
    })
  );
};

/** The lines of `src/` that hold the words: all there is to go on when the space does not author. */
const sourceLines = async (root: string, query: string): Promise<{ at: string; text: string }[]> => {
  const files = (await filesUnder(root, 'src')).filter(file => /\.(?:ts|tsx|json)$/.test(file));
  const lines: { at: string; text: string }[] = [];
  for (const file of files) {
    const text = await fs.readFile(path.join(root, file), 'utf-8');
    text.split('\n').forEach((line, index) => {
      if (line.includes(query)) {
        lines.push({ at: `${file}:${String(index + 1)}`, text: line.trim() });
      }
    });
  }

  return lines;
};

/** Every element the space authors to, read now — or why it does not author. */
export const locatedSpace = async (root: string): Promise<WrittenElement[] | { problem: string }> => {
  const loaded = await loadProjectSpace(root);
  if ('problem' in loaded) {
    return { problem: loaded.problem };
  }

  try {
    return locateElements(loaded.space, loaded.authoring);
  } catch (error) {
    return { problem: refusalOf(error).message.split('\n')[0] };
  }
};

/** The answer to a query, of the elements the space authors to. */
export const answerOf = async (
  root: string,
  elements: readonly WrittenElement[],
  query: string,
  by?: WhereReading
): Promise<WhereAnswer> => {
  const matched = matchElements(elements, query, by);
  if (!matched) {
    return { query, ...(by ? { by } : {}), matches: [] };
  }

  return {
    query,
    by: matched.by,
    matches: await withCode(root, matched.found, matched.by, byCall(elements)),
    ...(matched.found.length > MATCHES ? { more: matched.found.length - MATCHES } : {}),
    ...(matched.also.length > 0 ? { also: matched.also } : {})
  };
};

export const whereAnswer = async (root: string, query: string, by?: WhereReading): Promise<WhereAnswer> => {
  const elements = await locatedSpace(root);
  if (!('problem' in elements)) {
    return answerOf(root, elements, query, by);
  }

  const lines = await sourceLines(root, query);

  return {
    query,
    by: 'source',
    matches: [],
    lines: lines.slice(0, MATCHES),
    ...(lines.length > MATCHES ? { more: lines.length - MATCHES } : {}),
    problem: `the space does not author (${elements.problem}), so these are the lines of src/ that hold "${query}"`
  };
};

const matchText = (match: WhereMatch): string[] => [
  `${match.elementId} (${match.type}) — ${match.at ?? 'no call of the project writes it: a page’s own root, or a part of a component'}`,
  ...(match.code ? match.code.split('\n').map(line => `    ${line}`) : []),
  ...(match.bound
    ? [`    Bound: ${match.bound.join(', ')} — the page shows what the binding computes, not the value written.`]
    : []),
  ...(match.sharedWith
    ? [`    The same call also writes ${match.sharedWith.join(', ')}: an edit there changes every one.`]
    : []),
  ...(match.ownCall
    ? [
        `    Its own call is ${match.ownCall.at}:`,
        ...(match.ownCall.code ? match.ownCall.code.split('\n').map(line => `      ${line}`) : [])
      ]
    : [])
];

/** The next command, when there is one obvious one. */
const READING_SAID: Record<WhereReading, string> = {
  id: 'by id',
  class: 'wearing the class',
  text: 'showing the words'
};

const nextStep = (answer: WhereAnswer): string | undefined => {
  const [only] = answer.matches;
  if (answer.matches.length !== 1 || !only.at) {
    return undefined;
  }

  const bound = only.bound ? ` (not ${only.bound.join(', ')}: a binding computes it)` : '';

  return `Next: plitzi edit ${only.elementId} --set <attribute>=<value>${bound} — or edit ${only.at} by hand`;
};

const whereText = (answer: WhereAnswer): string => {
  if (answer.by === 'source') {
    return [
      answer.problem ?? '',
      ...(answer.lines ?? []).map(line => `  ${line.at}  ${line.text}`),
      ...(answer.more ? [`  … ${String(answer.more)} more`] : [])
    ].join('\n');
  }

  if (answer.matches.length === 0) {
    const asked =
      answer.by === undefined
        ? 'has the id, a class or the words'
        : READING_SAID[answer.by].replace(/^by /, 'has the ');

    return `No element ${asked} "${answer.query}". \`plitzi check\` lists the elements a page shows.`;
  }

  const said = READING_SAID[answer.by ?? 'id'];

  return [
    `${String(answer.matches.length + (answer.more ?? 0))} ${said} "${answer.query}":`,
    ...answer.matches.flatMap(matchText),
    ...(answer.more ? [`… ${String(answer.more)} more — ask for one by its id`] : []),
    ...(answer.also ?? []).map(
      other =>
        `Also ${String(other.count)} ${READING_SAID[other.by]} "${answer.query}": plitzi where "${answer.query}" --by ${other.by}`
    ),
    ...[nextStep(answer)].filter(line => line !== undefined)
  ].join('\n');
};

export const where = async (query: string, options: WhereOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail('Run this in a project whose space is written in it (`src/space/`).');

    return;
  }

  const answer = await whereAnswer(project.root, query, options.by);
  console.log(options.json ? JSON.stringify(answer) : whereText(answer));
  if (answer.matches.length === 0 && !answer.lines?.length) {
    process.exitCode = 1;
  }
};
