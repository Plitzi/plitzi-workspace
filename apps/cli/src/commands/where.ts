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

export interface WhereOptions {
  json?: boolean;
}

/** How a query found what it names. */
type WhereBy = 'id' | 'class' | 'text' | 'source';

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
}

export interface WhereAnswer {
  query: string;
  by?: WhereBy;
  matches: WhereMatch[];
  /** Matches past the first `MATCHES`, left out. */
  more?: number;
  /** Lines of `src/` holding the words, when the space could not be authored to find the element. */
  lines?: { at: string; text: string }[];
  problem?: string;
}

const MATCHES = 10;

const SNIPPETS = 3;

const SNIPPET_LINES = 12;

/** A name as compared: `nav-link`, `navLink` and `nav_link` are one. */
const comparable = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** What a query names: an element's id, then a class it wears, then words it shows — the first that matches. */
export const matchElements = (
  elements: readonly WrittenElement[],
  query: string
): { by: Exclude<WhereBy, 'source'>; found: WrittenElement[] } | undefined => {
  const byId = elements.filter(element => element.elementId === query);
  if (byId.length > 0) {
    return { by: 'id', found: byId };
  }

  // A class is asked for by its name (`nav-link`) or by the variable that holds it in the code (`navLink`).
  const className = comparable(query);
  const byClass = elements.filter(element => element.classes.some(name => comparable(name) === className));
  if (byClass.length > 0) {
    return { by: 'class', found: byClass };
  }

  const words = query.toLowerCase();
  const byText = elements.filter(element => element.content?.toLowerCase().includes(words));

  return byText.length > 0 ? { by: 'text', found: byText } : undefined;
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
const withCode = async (root: string, found: readonly WrittenElement[], by: WhereBy): Promise<WhereMatch[]> => {
  const ts = loadTypeScript(root);
  const shown = found.slice(0, MATCHES);

  return Promise.all(
    shown.map(async (element, index) => {
      const { position, attributes, ...facts } = element;
      const match: WhereMatch = { ...facts, ...(position ? { position } : {}), ...(by === 'id' ? { attributes } : {}) };
      if (!ts || !position || index >= SNIPPETS) {
        return match;
      }

      const file = path.resolve(process.cwd(), position.file);
      const text = await fs.readFile(file, 'utf-8').catch(() => undefined);
      const code =
        text === undefined
          ? undefined
          : callTextAt(ts, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), position);

      return code === undefined ? match : { ...match, code: snippet(code) };
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

export const whereAnswer = async (root: string, query: string): Promise<WhereAnswer> => {
  const loaded = await loadProjectSpace(root);
  const elements = (() => {
    if ('problem' in loaded) {
      return { problem: loaded.problem };
    }

    try {
      return locateElements(loaded.space, loaded.authoring);
    } catch (error) {
      return { problem: refusalOf(error).message.split('\n')[0] };
    }
  })();

  if ('problem' in elements) {
    const lines = await sourceLines(root, query);

    return {
      query,
      by: 'source',
      matches: [],
      lines: lines.slice(0, MATCHES),
      ...(lines.length > MATCHES ? { more: lines.length - MATCHES } : {}),
      problem: `the space does not author (${elements.problem}), so these are the lines of src/ that hold "${query}"`
    };
  }

  const matched = matchElements(elements, query);
  if (!matched) {
    return { query, matches: [] };
  }

  return {
    query,
    by: matched.by,
    matches: await withCode(root, matched.found, matched.by),
    ...(matched.found.length > MATCHES ? { more: matched.found.length - MATCHES } : {})
  };
};

const matchText = (match: WhereMatch): string[] => [
  `${match.elementId} (${match.type}) — ${match.at ?? 'no call of the project writes it: a page’s own root, or a part of a component'}`,
  ...(match.code ? match.code.split('\n').map(line => `    ${line}`) : [])
];

/** The next command, when there is one obvious one. */
const nextStep = (answer: WhereAnswer): string | undefined => {
  const [only] = answer.matches;
  if (answer.matches.length !== 1 || !only.at) {
    return undefined;
  }

  return `Next: plitzi edit ${only.elementId} --set <attribute>=<value> — or edit ${only.at} by hand`;
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
    return `No element has the id, a class or the words "${answer.query}". \`plitzi check\` lists the elements a page shows.`;
  }

  const said = { id: 'by id', class: 'wearing the class', text: 'showing the words' }[answer.by ?? 'id'];

  return [
    `${String(answer.matches.length + (answer.more ?? 0))} ${said} "${answer.query}":`,
    ...answer.matches.flatMap(matchText),
    ...(answer.more ? [`… ${String(answer.more)} more — ask for one by its id`] : []),
    ...[nextStep(answer)].filter(line => line !== undefined)
  ].join('\n');
};

export const where = async (query: string, options: WhereOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail('Run this in a project whose space is written in it (`src/space/`).');

    return;
  }

  const answer = await whereAnswer(project.root, query);
  console.log(options.json ? JSON.stringify(answer) : whereText(answer));
  if (answer.matches.length === 0 && !answer.lines?.length) {
    process.exitCode = 1;
  }
};
