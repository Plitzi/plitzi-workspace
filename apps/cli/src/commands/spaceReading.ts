import { canonicalJson } from '@plitzi/sdk-shared/helpers/canonicalJson';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from './existingProject';
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
}

/** One difference between the space before and after: an attribute's carries its key and what it reads after. */
export interface SpaceEffect {
  elementId: string;
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

export const readingOf = ({
  elementId,
  type,
  rootId,
  classes,
  attributes,
  templates,
  bound
}: WrittenElement): ElementReading => ({ elementId, type, rootId, classes, attributes, templates, bound });

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
      isStrings(entry.bound)
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
  'bound'
];

/** Every difference between the space before and after, element by element and attribute by attribute. */
export const spaceEffects = (before: readonly ElementReading[], after: readonly ElementReading[]): SpaceEffect[] => {
  const was = new Map(before.map(element => [element.elementId, element]));
  const is = new Map(after.map(element => [element.elementId, element]));
  const effects: SpaceEffect[] = [];
  for (const [elementId, element] of was) {
    if (!is.has(elementId)) {
      effects.push({ elementId, line: `${elementId} (${element.type}) removed` });
    }
  }

  for (const [elementId, element] of is) {
    const old = was.get(elementId);
    if (!old) {
      effects.push({ elementId, line: `${elementId} (${element.type}) added` });
      continue;
    }

    for (const field of FIELDS) {
      if (canonicalJson(old[field]) !== canonicalJson(element[field])) {
        effects.push({ elementId, line: `${elementId} ${field}: ${shown(old[field])} → ${shown(element[field])}` });
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
      effects.push({ elementId, key, line });
    }
  }

  return effects;
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

/**
 * `plitzi elements`, not listed: the space as `ElementReading[]`, or `{ problem }` — what `plitzi edit` reads in a fresh
 * process after it changed a file the one running it had already loaded.
 */
export const elements = async (): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail('Run this in a project whose space is written in it (`src/space/`).');

    return;
  }

  const located = await locatedSpace(project.root);
  console.log(JSON.stringify('problem' in located ? located : located.map(readingOf)));
};
