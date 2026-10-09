import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { closest } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { fail } from './terminal';

/**
 * `plitzi data describe <file>`: the shape of a JSON document, in a few lines — what an agent needs to bind to it, without reading it.
 *
 * A catalogue of 879 products is half a megabyte, and what anything written against it needs is the twenty field
 * names and their types: which are always there, which only sometimes, and how long the lists are. Every value is
 * read, so a field that appears in one row of nine hundred is still found, and said to be optional.
 */

type ObjectShape = { count: number; fields: Map<string, { count: number; shape: Shape }> };

type ArrayShape = { occurrences: number; lengths: Set<number>; item: Shape };

/** An object keyed by data — slugs, ids — whose values share one shape: said once, with how many keys. */
type MapShape = { keys: string[]; value: Shape };

type Shape = { primitives: Set<string>; object?: ObjectShape; array?: ArrayShape; map?: MapShape };

const emptyShape = (): Shape => ({ primitives: new Set() });

const merge = (shape: Shape, value: unknown): void => {
  if (value === null) {
    shape.primitives.add('null');

    return;
  }

  if (Array.isArray(value)) {
    shape.array ??= { occurrences: 0, lengths: new Set(), item: emptyShape() };
    shape.array.occurrences += 1;
    shape.array.lengths.add(value.length);
    for (const item of value) {
      merge(shape.array.item, item);
    }

    return;
  }

  // Keyed by data — no key is a name a program would give a field (`the-quiet-death`, `1042`) — it is a map: every
  // value merged into one shape, as a list's items are, so five hundred articles read as one.
  const keys = isRecord(value) ? Object.keys(value) : [];
  if (isRecord(value) && keys.length >= 2 && keys.every(key => !KEY.test(key))) {
    shape.map ??= { keys: [], value: emptyShape() };
    shape.map.keys.push(...keys);
    for (const field of Object.values(value)) {
      merge(shape.map.value, field);
    }

    return;
  }

  if (isRecord(value)) {
    shape.object ??= { count: 0, fields: new Map() };
    shape.object.count += 1;
    for (const [key, field] of Object.entries(value)) {
      const entry = shape.object.fields.get(key) ?? { count: 0, shape: emptyShape() };
      entry.count += 1;
      merge(entry.shape, field);
      shape.object.fields.set(key, entry);
    }

    return;
  }

  shape.primitives.add(typeof value);
};

/** Past this many fields an object is summarised: a map keyed by ids is data, not a shape. */
const MAX_FIELDS = 40;

const PAD = '  ';

const KEY = /^[A-Za-z_$][\w$]*$/;

const render = (shape: Shape, depth: number): string => {
  const parts = [...shape.primitives].sort();
  if (shape.object) {
    parts.push(renderObject(shape.object, depth));
  }

  if (shape.array) {
    parts.push(renderArray(shape.array, depth));
  }

  if (shape.map) {
    const { keys, value } = shape.map;
    const sample = keys
      .slice(0, 3)
      .map(key => JSON.stringify(key))
      .join(', ');
    parts.push(
      `{ [key]: ${render(value, depth)} }  (${String(keys.length)} keys: ${sample}${keys.length > 3 ? ', …' : ''})`
    );
  }

  return parts.length > 0 ? parts.join(' | ') : 'never';
};

const renderArray = ({ occurrences, lengths, item }: ArrayShape, depth: number): string => {
  const inner = render(item, depth);
  if (occurrences === 1) {
    const [length] = lengths;

    return length === 0 ? 'Array(0)' : `Array(${String(length)}) of ${inner}`;
  }

  return inner.includes(' | ') ? `(${inner})[]` : `${inner}[]`;
};

const renderObject = ({ count, fields }: ObjectShape, depth: number): string => {
  if (fields.size === 0) {
    return '{}';
  }

  const indent = PAD.repeat(depth + 1);
  const entries = [...fields].slice(0, MAX_FIELDS).map(([key, field]) => {
    const name = KEY.test(key) ? key : JSON.stringify(key);
    const optional = field.count < count;
    const seen = optional && count > 1 ? `  (in ${String(field.count)} of ${String(count)})` : '';

    return `${indent}${name}${optional ? '?' : ''}: ${render(field.shape, depth + 1)}${seen}`;
  });
  const more = fields.size > MAX_FIELDS ? [`${indent}… ${String(fields.size - MAX_FIELDS)} more keys`] : [];

  return ['{', ...entries, ...more, `${PAD.repeat(depth)}}`].join('\n');
};

/** The longest list of objects in the document, and where it is — the rows a page most likely renders. */
const rowsOf = (value: unknown): { path: string; rows: unknown[] } | undefined => {
  const candidates: { path: string; rows: unknown[] }[] = [];
  const visit = (node: unknown, at: string): void => {
    if (Array.isArray(node)) {
      if (node.some(isRecord)) {
        candidates.push({ path: at, rows: node });
      }

      node.forEach((item, index) => visit(item, `${at}[${String(index)}]`));

      return;
    }

    if (isRecord(node)) {
      for (const [key, field] of Object.entries(node)) {
        visit(field, at ? `${at}.${key}` : key);
      }
    }
  };

  visit(value, '');

  return candidates.sort((a, b) => b.rows.length - a.rows.length)[0];
};

/** One row, shortened: long text cut, long lists cut to their first items. */
const shorten = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  }

  if (Array.isArray(value)) {
    return value.length > 3
      ? [...value.slice(0, 3).map(shorten), `… ${String(value.length - 3)} more`]
      : value.map(shorten);
  }

  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, shorten(field)]));
  }

  return value;
};

export type DataDescription = {
  /** The shape, as TypeScript-like text: `{ products: Array(879) of { id: string, … } }`. */
  shape: string;
  /** The first row of the longest list of objects, shortened, and where that list is. */
  example?: { path: string; row: unknown };
};

export const describeData = (value: unknown): DataDescription => {
  const shape = emptyShape();
  merge(shape, value);
  const rows = rowsOf(value);
  const first = rows?.rows.find(isRecord);

  return {
    shape: render(shape, 0),
    ...(rows && first ? { example: { path: rows.path || '(the document)', row: shorten(first) } } : {})
  };
};

export interface DataDescribeOptions {
  json?: boolean;
}

export const dataDescribe = async (file: string, options: DataDescribeOptions): Promise<void> => {
  let value: unknown;
  try {
    value = JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (error) {
    // A file written a letter off is offered the nearest one beside it, rather than the system's ENOENT.
    const missing = isRecord(error) && error.code === 'ENOENT';
    const beside = missing
      ? await fs.readdir(path.dirname(file)).then(
          names => names.filter(name => name.endsWith('.json')),
          () => []
        )
      : [];
    const nearest = closest(path.basename(file), beside);
    fail(
      missing
        ? `${file} does not exist${nearest ? ` — did you mean ${path.join(path.dirname(file), nearest)}?` : beside.length > 0 ? `: the JSON there is ${beside.join(', ')}` : '.'}`
        : `${file} is not a JSON file this can read: ${error instanceof Error ? error.message : String(error)}`
    );

    return;
  }

  const description = describeData(value);
  if (options.json) {
    console.log(JSON.stringify(description));

    return;
  }

  console.log(description.shape);
  if (description.example) {
    console.log(`\n${chalk.dim(`One row of ${description.example.path}:`)}`);
    console.log(JSON.stringify(description.example.row, null, 2));
  }
};
