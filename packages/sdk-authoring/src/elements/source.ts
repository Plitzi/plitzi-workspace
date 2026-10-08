import { scoped } from './scope';
import { AuthoringError } from '../schema/codes';
import { didYouMean } from '../schema/suggest';

const PATH = Symbol('plitzi.sourcePath');
const SHAPE = Symbol('plitzi.sourceShape');

/** What every path to a source's value is, whatever it leads to. */
export interface SourceBrand {
  readonly [PATH]: string;
  /** The full name: `String(site.data.total)`. */
  toString(): string;
}

/** A source's name: written by hand (`'catalog.data.products'`), or reached through {@link source}. */
export type SourceName = string | SourceBrand;

/**
 * A path into a source, typed by a sample of what it holds: `site.data.hero.title` is the name
 * `apiContainer_site.data.hero.title`. A field the sample does not have is a type error where it is written. It is
 * the full name, so it reads the same in `from`, `items`, `bind` and a template (`` `{{ ${site.data.total} }}` ``); an
 * item of a list is `.0`, `.1` — `site.data.sections[1]`.
 */
export type SourcePath<T> = SourceBrand &
  (T extends readonly (infer Item)[]
    ? { readonly [index: number]: SourcePath<Item> }
    : T extends object
      ? { readonly [Key in keyof T]-?: SourcePath<T[Key]> }
      : unknown);

/** How a provider's asking went — what every `apiContainer` publishes beside its answer. */
export interface ProviderState {
  isLoading: boolean;
  isEmpty: boolean;
  hasError: boolean;
  errorMessage: string;
  isStale: boolean;
}

/** What an `apiContainer` asking a `query` publishes: the answer under `data`, and how the asking went. */
export interface ApiContainerSource<Data> extends ProviderState {
  data: Data;
}

/** What an `apiContainer` fed by a server action publishes: the action's output at its root, beside its state. */
export type ActionProviderSource<Output> = Output & ProviderState;

const PROVIDER_STATE: ProviderState = {
  isLoading: false,
  isEmpty: false,
  hasError: false,
  errorMessage: '',
  isStale: false
};

/** What a path leads to in the sample, or `UNKNOWN` below a point the sample does not describe (`null`, `[]`). */
const UNKNOWN = Symbol('plitzi.unknownShape');
type Shape = unknown;

/** Every item of a list read as one: the fields any of them has, so an optional field in the sample still counts. */
const itemShape = (items: readonly unknown[]): Shape => {
  const objects = items.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)
  );
  if (objects.length === 0) {
    return items.length === 0 ? UNKNOWN : items[0];
  }

  return Object.assign({}, ...objects.toReversed());
};

const fieldShape = (name: string, shape: Shape, key: string): Shape => {
  if (shape === UNKNOWN || shape === null) {
    return UNKNOWN;
  }

  if (Array.isArray(shape)) {
    if (/^\d+$/.test(key)) {
      return itemShape(shape);
    }
  } else if (typeof shape === 'object' && Object.hasOwn(shape, key)) {
    const fields: Record<string, unknown> = { ...shape };

    return fields[key];
  }

  const fields = typeof shape === 'object' && !Array.isArray(shape) ? Object.keys(shape) : [];
  const has = Array.isArray(shape)
    ? `"${name}" is a list, read by position: \`.0\`, or \`[0]\`.`
    : typeof shape === 'object'
      ? `"${name}" has ${fields.map(field => `"${field}"`).join(', ') || 'no fields'} in the sample.`
      : `"${name}" is a ${typeof shape} in the sample, with no fields.`;
  throw new AuthoringError(
    'source-field-unknown',
    `"${name}.${key}" is not in the sample its source was typed with${didYouMean(key, fields)} ${has} A field the sample lacks is one the answer may not have either: add it to the sample, or read one it has.`
  );
};

const named = (name: string): string => name;

const pathTo = (name: string, shape: Shape, own: Record<string, string> = {}): SourceBrand =>
  new Proxy<SourceBrand>(
    { [PATH]: name },
    {
      get: (target, key) => {
        if (key === PATH) {
          return target[PATH];
        }

        if (key === SHAPE) {
          return shape;
        }

        // A path is written into text — a template, a key, JSON — as its name.
        if (key === Symbol.toPrimitive || key === 'toString' || key === 'toJSON' || key === 'valueOf') {
          return named.bind(null, name);
        }

        // Not a promise: whatever checks for one — an `await`, `Promise.resolve` — must not be refused a field.
        if (typeof key === 'symbol' || key === 'then') {
          return undefined;
        }

        if (Object.hasOwn(own, key)) {
          return own[key];
        }

        return pathTo(`${name}.${key}`, fieldShape(name, shape, key));
      }
    }
  );

export const isSourcePath = (value: unknown): value is SourceBrand =>
  typeof value === 'object' && value !== null && PATH in value;

/** The name a source path stands for; a name written by hand is already one. */
export const sourceName = (value: SourceName): string => (typeof value === 'string' ? value : value[PATH]);

/**
 * The row of a list fed by a typed source: its item as the sample's item, its position as a number — both already the
 * full names a template reads (`` `{{ ${r.item.slug} }}` ``), and `inTemplate` the same names as text, as an untyped
 * row has them.
 */
export interface SourceRow<Item> {
  item: SourcePath<Item>;
  index: SourcePath<number>;
  inTemplate: { item: string; index: string };
}

/** The row of the list whose rows publish `listSource` (`list_products`), its items what the path `items` leads to. */
export const sourceRow = <Item>(listSource: string, items: SourcePath<readonly Item[]>): SourceRow<Item> => {
  const shape: unknown = Reflect.get(items, SHAPE);

  // A proxy answers any key at all; what makes these the row's types is the sample, checked as each key is read.
  return {
    item: pathTo(`${listSource}.item`, Array.isArray(shape) ? itemShape(shape) : UNKNOWN),
    index: pathTo(`${listSource}.index`, 0),
    inTemplate: { item: `${listSource}.item`, index: `${listSource}.index` }
  } as SourceRow<Item>;
};

/**
 * The `apiContainer` with this id as a typed source, its `data` typed — and checked — by a sample of the answer: the
 * JSON file the query reads, imported (`import home from './home.json' with { type: 'json' }`):
 *
 * ```ts
 * const site = source('site', home);
 * apiContainer({ id: site.id, query: '/data/home.json', children: [heading({ from: site.data.hero.title })] });
 * ```
 *
 * A path the sample does not have is a type error, and refused (`source-field-unknown`) where the types were not
 * looking. Nothing of the sample is written into the space. Inside a `scope()`, the id is the scoped one, as the
 * element's is.
 */
export const source = <Data>(
  id: string,
  sample: Data
): SourcePath<ApiContainerSource<Data>> & { readonly id: string } => {
  const full = scoped(id);
  const published: ApiContainerSource<Data> = { data: sample, ...PROVIDER_STATE };

  // A proxy answers any key at all; what makes it this type is the sample, checked as each key is read.
  return pathTo(`apiContainer_${full}`, published, { id: full }) as SourcePath<ApiContainerSource<Data>> & {
    readonly id: string;
  };
};

/**
 * The `apiContainer` with this id, fed by a server action, as a typed source: the action's OUTPUT is published at its
 * root — `feed.stories`, never `feed.data.stories` — typed and checked by a sample of that output:
 *
 * ```ts
 * const feed = actionSource('feed', { stories: [{ id: 'a', title: '' }], updatedAt: '' });
 * apiContainer({ id: feed.id, runtime: 'server', action: 'world-report', children: [
 *   list({ id: 'stories', items: feed.stories, row: s => listItem({ children: [text({ from: s.item.title })] }) })
 * ] });
 * ```
 *
 * The output is what the action's last step answers — a sample written by hand, or the type of the task's result.
 */
export const actionSource = <Output extends object>(
  id: string,
  sample: Output
): SourcePath<ActionProviderSource<Output>> & { readonly id: string } => {
  const full = scoped(id);
  const published: ActionProviderSource<Output> = { ...sample, ...PROVIDER_STATE };

  return pathTo(`apiContainer_${full}`, published, { id: full }) as SourcePath<ActionProviderSource<Output>> & {
    readonly id: string;
  };
};

/**
 * A template with paths in it, each written as its full name: `` twig`{{ ${site.data.total} + 1 }}` ``. A plain
 * template literal writes the same text, but a type-checked lint refuses an object inside one.
 */
export const twig = (parts: TemplateStringsArray, ...values: (SourceName | number)[]): string =>
  parts.reduce((text, part, index) => {
    const value = index < values.length ? values[index] : '';

    return `${text}${part}${typeof value === 'number' ? String(value) : sourceName(value)}`;
  }, '');
