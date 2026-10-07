import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { authorSpace, refusalOf } from '@plitzi/sdk-authoring';
import { canonicalJson } from '@plitzi/sdk-shared/helpers/canonicalJson';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from './existingProject';
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { locatedSpace } from './where';

import type { WrittenElement } from '@plitzi/sdk-authoring';

/**
 * The space read as what each element is — never where it is written, which an edit moves — so what an edit did is
 * read off the space before and after it, and nothing it changed goes unsaid: the element it was asked for, and any
 * other one a shared call, a constant or a helper reached too.
 */

/** What one element is. */
export interface ElementReading {
  elementId: string;
  type: string;
  rootId: string;
  classes: string[];
  attributes: Record<string, unknown>;
  templates: string[];
  bound: string[];
  /** The elements it holds, in their order: what a move changes, and a removal takes one from. */
  children: string[];
}

/** One difference between the space before and after: an attribute's carries its key and what it reads after. */
export interface SpaceEffect {
  elementId: string;
  /** An element that came or went, one of its fields (its classes, its children…), or one of its attributes. */
  kind: 'added' | 'removed' | 'field' | 'attribute';
  /** For a field: which. */
  field?: keyof ElementReading;
  /** The attribute that changed; absent for anything else about the element — its classes, its place, itself. */
  key?: string;
  line: string;
}

/** An attribute an edit is asked to write — or, with no value, to remove. */
export interface AskedChange {
  key: string;
  value?: string | number | boolean;
}

const SHOWN = 60;

/** As much of a refusal as says what broke: its head and its first problems, each with where it is. */
const GATE_LINES = 12;

export const readingOf = ({
  elementId,
  type,
  rootId,
  classes,
  attributes,
  templates,
  bound,
  children
}: WrittenElement): ElementReading => ({ elementId, type, rootId, classes, attributes, templates, bound, children });

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/** What another process printed, read as the space when every entry is an element's reading. */
export const isReadings = (value: unknown): value is ElementReading[] =>
  Array.isArray(value) &&
  value.every(
    entry =>
      isRecord(entry) &&
      typeof entry.elementId === 'string' &&
      typeof entry.type === 'string' &&
      typeof entry.rootId === 'string' &&
      isStrings(entry.classes) &&
      isRecord(entry.attributes) &&
      isStrings(entry.templates) &&
      isStrings(entry.bound) &&
      isStrings(entry.children)
  );

const shown = (value: unknown): string => {
  const text = canonicalJson(value);

  return text.length > SHOWN ? `${text.slice(0, SHOWN - 1)}…` : text;
};

const FIELDS: readonly (keyof Omit<ElementReading, 'elementId' | 'attributes'>)[] = [
  'type',
  'rootId',
  'classes',
  'templates',
  'bound',
  'children'
];

/**
 * How an element's children changed, in the words that say it: those added and those gone, or the one that moved and
 * where it is now — never two lists cut short where the difference is.
 */
export const childrenChange = (before: readonly string[], after: readonly string[]): string => {
  const added = after.filter(id => !before.includes(id));
  const removed = before.filter(id => !after.includes(id));
  if (added.length > 0 || removed.length > 0) {
    return [...added.map(id => `+${id}`), ...removed.map(id => `−${id}`)].join(' ');
  }

  // The one whose move explains the whole difference: without it, the two orders are the same.
  const moved = after.find(
    id => before.filter(other => other !== id).join('\n') === after.filter(other => other !== id).join('\n')
  );
  if (moved === undefined) {
    return `reordered: ${after.join(', ')}`;
  }

  const at = after.indexOf(moved);
  const neighbours = [
    ...(at > 0 ? [`after ${after[at - 1]}`] : ['first']),
    ...(at < after.length - 1 ? [`before ${after[at + 1]}`] : ['last'])
  ];

  return `${moved} moved — now ${neighbours.join(', ')}`;
};

/** Every difference between the space before and after, element by element and attribute by attribute. */
export const spaceEffects = (before: readonly ElementReading[], after: readonly ElementReading[]): SpaceEffect[] => {
  const was = new Map(before.map(element => [element.elementId, element]));
  const is = new Map(after.map(element => [element.elementId, element]));
  const effects: SpaceEffect[] = [];
  for (const [elementId, element] of was) {
    if (!is.has(elementId)) {
      effects.push({ elementId, kind: 'removed', line: `${elementId} (${element.type}) removed` });
    }
  }

  for (const [elementId, element] of is) {
    const old = was.get(elementId);
    if (!old) {
      effects.push({ elementId, kind: 'added', line: `${elementId} (${element.type}) added` });
      continue;
    }

    for (const field of FIELDS) {
      if (canonicalJson(old[field]) !== canonicalJson(element[field])) {
        effects.push({
          elementId,
          kind: 'field',
          field,
          line:
            field === 'children'
              ? `${elementId} children: ${childrenChange(old.children, element.children)}`
              : `${elementId} ${field}: ${shown(old[field])} → ${shown(element[field])}`
        });
      }
    }

    for (const key of new Set([...Object.keys(old.attributes), ...Object.keys(element.attributes)])) {
      const from = old.attributes[key];
      const to = element.attributes[key];
      if (canonicalJson(from) === canonicalJson(to)) {
        continue;
      }

      const line =
        from === undefined
          ? `${elementId}.${key} = ${shown(to)}`
          : to === undefined
            ? `${elementId}.${key} removed (was ${shown(from)})`
            : `${elementId}.${key}: ${shown(from)} → ${shown(to)}`;
      effects.push({ elementId, kind: 'attribute', key, line });
    }
  }

  return effects;
};

/**
 * The effects as lines to read: an element added or removed with everything inside it said once, by the outermost of
 * them, with how many it held — nineteen lines of a modal's parts are one. Every other effect is its own line.
 */
export const effectLines = (
  effects: readonly SpaceEffect[],
  before: readonly ElementReading[],
  after: readonly ElementReading[]
): string[] => {
  const parentIn = (readings: readonly ElementReading[]): Map<string, string> =>
    new Map(readings.flatMap(reading => reading.children.map((child): [string, string] => [child, reading.elementId])));
  const parents = { removed: parentIn(before), added: parentIn(after) };
  const lines: string[] = [];
  const kinds: readonly ('removed' | 'added')[] = ['removed', 'added'];
  for (const kind of kinds) {
    const ids = new Set(effects.filter(effect => effect.kind === kind).map(effect => effect.elementId));
    const outermost = (id: string): string => {
      const parent = parents[kind].get(id);

      return parent !== undefined && ids.has(parent) ? outermost(parent) : id;
    };
    const inside = new Map<string, number>();
    for (const id of ids) {
      const top = outermost(id);
      inside.set(top, (inside.get(top) ?? 0) + (top === id ? 0 : 1));
    }

    for (const effect of effects.filter(each => each.kind === kind && inside.has(each.elementId))) {
      const held = inside.get(effect.elementId) ?? 0;
      lines.push(held > 0 ? `${effect.line}, with ${String(held)} inside` : effect.line);
    }
  }

  return [...lines, ...effects.filter(effect => effect.kind !== 'removed' && effect.kind !== 'added').map(e => e.line)];
};

/**
 * Why the space after an edit is not what was asked of it: a change that is not there, and every one nobody asked for
 * — a shared call, a constant, a helper that reached another element. Nothing when it is exactly what was asked.
 */
export const surprises = (
  effects: readonly SpaceEffect[],
  after: readonly ElementReading[],
  asked: ReadonlyMap<string, readonly AskedChange[]>
): string[] => {
  const readings = new Map(after.map(element => [element.elementId, element]));
  const absent = [...asked].flatMap(([elementId, changes]) => {
    const element = readings.get(elementId);
    if (!element) {
      return [`${elementId} is no longer in the space`];
    }

    return changes
      .filter(change =>
        change.value === undefined
          ? change.key in element.attributes
          : canonicalJson(element.attributes[change.key]) !== canonicalJson(change.value)
      )
      .map(change =>
        change.value === undefined
          ? `${elementId}.${change.key} is still set`
          : `${elementId}.${change.key} reads ${shown(element.attributes[change.key])}, not ${shown(change.value)}`
      );
  });
  const unasked = effects
    .filter(
      effect => effect.key === undefined || !asked.get(effect.elementId)?.some(change => change.key === effect.key)
    )
    .map(effect => `it changed ${effect.line} too, which was not asked`);

  return [...absent, ...unasked];
};

/**
 * The elements an edit reached beyond those asked, each given the very attribute and value asked for: one value
 * written once and read in two places — a list entry a menu and a nav both draw. What `--every` takes as meant;
 * anything else it changed stays a surprise.
 */
export const reachedToo = (
  effects: readonly SpaceEffect[],
  after: readonly ElementReading[],
  asked: ReadonlyMap<string, readonly AskedChange[]>,
  changes: readonly AskedChange[]
): { elementId: string; change: AskedChange }[] => {
  const readings = new Map(after.map(element => [element.elementId, element]));

  return effects.flatMap(({ elementId, key }) => {
    const change = changes.find(candidate => candidate.key === key && candidate.value !== undefined);
    const reads = readings.get(elementId)?.attributes[key ?? ''];
    if (
      key === undefined ||
      !change ||
      asked.get(elementId)?.some(known => known.key === key) ||
      canonicalJson(reads) !== canonicalJson(change.value)
    ) {
      return [];
    }

    return [{ elementId, change }];
  });
};

const run = promisify(execFile);

/** The space as it authors now, read by a fresh process: this one loaded the files before they were edited. */
export const readAfresh = async (): Promise<ElementReading[] | { problem: string }> => {
  try {
    const { stdout } = await run(process.execPath, [process.argv[1], 'element', 'readings'], {
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

/**
 * `plitzi element readings`, not listed: the space as `ElementReading[]`, or `{ problem }` — what `plitzi element edit` reads in a fresh
 * process after it changed a file the one running it had already loaded.
 */
export const elements = async (): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail('Run this in a project whose space is written in it (`src/space/`).');

    return;
  }

  // Through the same gate `npm run author` is: a space that writes but would be refused — a step pointed at an element
  // that is gone — is a space an edit broke, and it is said so rather than read as fine.
  const loaded = await loadProjectSpace(project.root);
  if ('problem' in loaded) {
    console.log(JSON.stringify({ problem: loaded.problem }));

    return;
  }

  try {
    authorSpace(loaded.space, loaded.authoring);
  } catch (error) {
    console.log(JSON.stringify({ problem: refusalOf(error).message.split('\n').slice(0, GATE_LINES).join('\n') }));

    return;
  }

  const located = await locatedSpace(project.root);
  console.log(JSON.stringify('problem' in located ? located : located.map(readingOf)));
};
