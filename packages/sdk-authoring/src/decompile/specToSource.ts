/* eslint-disable quotes */
import { defaultAttributes, defaultLabel } from '../elements';
import * as factories from '../elements/elements';

import type { ElementSpec, LayoutSpec, PageSpec, SpaceSpec } from '../schema';
import type { StyleSpec } from '../style';

/**
 * A {@link SpaceSpec}, written out as the TypeScript a person would have written.
 *
 * Every element is a call to its factory — `heading('Hi', { subType: 'h2' })` — with the attributes its type
 * already defaults to left out, because the factory puts them back. A class something names becomes a `styles()`
 * declaration next to the space and is named by variable, so a typo is a compile error rather than an unstyled
 * element. The output is valid but unformatted: run it through the project's formatter.
 */

export interface SpecSourceOptions {
  /** What the space is exported as: `export const <exportName>: SpaceSpec`. */
  exportName: string;
  /** Where the authoring surface is imported from. */
  packageName?: string;
  /**
   * One file per page and per layout, beside one for the shared classes, instead of a single file. What a space of
   * thousands of elements wants: a page is then something one can open.
   */
  split?: boolean;
}

/** Source files by path, relative to wherever they are written. The space itself is `index.ts`. */
export type SpecSourceFiles = Record<string, string>;

/**
 * Every field of an element spec, in the order the emitter writes them.
 *
 * The emitter is only as current as this list: a field `ElementSpec` gains and this does not name is a field every
 * export drops without a word. `specFields.test.ts` refuses to compile until it is listed here — and once it is, it is
 * written like any other, so growing the authoring surface needs nothing more from the emitter than this line.
 */
export const ELEMENT_FIELDS = [
  'type',
  'id',
  'attributes',
  'class',
  'css',
  'states',
  'variant',
  'slots',
  'bind',
  'visible',
  'flows',
  'runtime',
  'loadStrategy',
  'meta',
  'children'
] as const satisfies readonly (keyof ElementSpec)[];

/** The same guarantee for the space itself, in the order its fields are written. */
export const SPACE_FIELDS = [
  'name',
  'permanentUrl',
  'mode',
  'theme',
  'variables',
  'fonts',
  'elements',
  'classes',
  'schemaVariables',
  'settings',
  'customCss',
  'rsc',
  'pageFolders',
  'layouts',
  'pages'
] as const satisfies readonly (keyof SpaceSpec)[];

/** The fields that are not attributes. An attribute sharing one of these names cannot be written flat. */
const AUTHORING_FIELDS = new Set<string>(ELEMENT_FIELDS.filter(field => field !== 'type' && field !== 'attributes'));

/** Written by the factory call itself rather than as a prop: the type is the factory, the rest have their own place. */
const STRUCTURAL_FIELDS = new Set<string>(['type', 'id', 'attributes', 'meta', 'children']);

const FACTORY_NAMES = new Set(Object.keys(factories));

const RESERVED = new Set(
  (
    'break case catch class const continue debugger default delete do else enum export extends false finally for ' +
    'function if import in instanceof new null return super switch this throw true try typeof var void while with ' +
    'yield let static implements interface package private protected public await element styles'
  ).split(' ')
);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const camel = (value: string): string => {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');

  return /^[0-9]/.test(joined) || !joined ? `c${joined}` : joined;
};

/** A name with a suffix it does not already end in — `docsPage`, never `analyticsPagePage`. */
const withSuffix = (name: string, suffix: string): string => (name.endsWith(suffix) ? name : `${name}${suffix}`);

/** A string as a literal: a template literal when it spans lines — a stylesheet, a head snippet — and quotes when not. */
const stringLiteral = (value: string): string =>
  value.includes('\n')
    ? `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``
    : `'${JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

const keyLiteral = (key: string): string => (IDENTIFIER.test(key) ? key : stringLiteral(key));

/** Anything JSON-shaped, as a TypeScript literal. */
const literal = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return stringLiteral(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(literal).join(', ')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, inner]) => inner !== undefined);

    return entries.length === 0
      ? '{}'
      : `{ ${entries.map(([key, inner]) => `${keyLiteral(key)}: ${literal(inner)}`).join(', ')} }`;
  }

  return 'null';
};

/** Names every declaration a file holds, so no two collide with each other or with what the file imports. */
class Names {
  private readonly taken = new Set<string>([...FACTORY_NAMES, ...RESERVED]);

  claim(base: string): string {
    const candidates = [base, `${base}Style`];
    for (const candidate of candidates) {
      if (!this.taken.has(candidate)) {
        this.taken.add(candidate);

        return candidate;
      }
    }

    let index = 2;
    while (this.taken.has(`${base}${index}`)) {
      index += 1;
    }

    this.taken.add(`${base}${index}`);

    return `${base}${index}`;
  }
}

/** What one file uses, so its imports are exactly that. */
class FileImports {
  readonly values = new Set<string>();

  readonly types = new Set<string>();

  readonly locals = new Map<string, Set<string>>();

  local(from: string, name: string): void {
    const names = this.locals.get(from) ?? new Set<string>();
    names.add(name);
    this.locals.set(from, names);
  }

  render(packageName: string): string {
    const sorted = (names: Set<string>): string => [...names].sort((a, b) => a.localeCompare(b)).join(', ');
    const groups = [
      this.values.size > 0 ? `import { ${sorted(this.values)} } from '${packageName}';` : '',
      [...this.locals]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([from, names]) => `import { ${sorted(names)} } from '${from}';`)
        .join('\n'),
      this.types.size > 0 ? `import type { ${sorted(this.types)} } from '${packageName}';` : ''
    ];

    return groups.filter(Boolean).join('\n\n');
  }
}

class SourceWriter {
  private readonly names = new Names();

  /** Class name → the variable its `styles()` declaration is held in. */
  private readonly classVariables = new Map<string, string>();

  private readonly files: SpecSourceFiles = {};

  private readonly packageName: string;

  constructor(
    private readonly spec: SpaceSpec,
    private readonly options: SpecSourceOptions
  ) {
    this.packageName = options.packageName ?? '@plitzi/sdk-authoring';
    this.names.claim(options.exportName);
  }

  write(): SpecSourceFiles {
    const named = this.namedClasses();
    for (const name of named) {
      this.classVariables.set(name, this.names.claim(camel(name)));
    }

    const unnamed = Object.fromEntries(Object.entries(this.spec.classes ?? {}).filter(([name]) => !named.has(name)));
    const main = new FileImports();
    main.types.add('SpaceSpec');

    const styleFile = this.options.split ? new FileImports() : main;
    const declarations = [...named].map(name => this.classDeclaration(name, styleFile));

    const layouts = (this.spec.layouts ?? []).map(layout =>
      this.root(layout, 'LayoutSpec', main, `layouts/${layout.id}`)
    );
    const pages = this.spec.pages.map(page =>
      this.root(page, 'PageSpec', main, `pages/${page.id ?? (page.slug || 'home')}`)
    );

    const written: Partial<Record<keyof SpaceSpec, string>> = {
      classes: Object.keys(unnamed).length > 0 ? literal(unnamed) : undefined,
      layouts: layouts.length > 0 ? `[${layouts.join(', ')}]` : undefined,
      pages: `[${pages.join(', ')}]`
    };
    const space = SPACE_FIELDS.flatMap(key => {
      const value = Object.hasOwn(written, key)
        ? written[key]
        : this.spec[key] === undefined
          ? undefined
          : literal(this.spec[key]);

      return value === undefined ? [] : [`${key}: ${value}`];
    });
    const body = `export const ${this.options.exportName}: SpaceSpec = { ${space.join(', ')} };`;

    if (this.options.split) {
      if (declarations.length > 0) {
        styleFile.values.add('styles');
        this.files['styles.ts'] =
          `${styleFile.render(this.packageName)}\n\n${declarations.map(line => `export ${line}`).join('\n\n')}\n`;
      }

      this.files['index.ts'] = `${main.render(this.packageName)}\n\n${body}\n`;
    } else {
      if (declarations.length > 0) {
        main.values.add('styles');
      }

      this.files['index.ts'] = `${main.render(this.packageName)}\n\n${[...declarations, body].join('\n\n')}\n`;
    }

    return this.files;
  }

  /** The classes an element, a slot, a page or a layout names — the ones worth a variable. */
  private namedClasses(): Set<string> {
    const named = new Set<string>();
    const add = (value: unknown): void => {
      if (typeof value === 'string') {
        named.add(value);
      }
    };

    const walk = (element: ElementSpec): void => {
      add(element.class);
      Object.values(element.slots ?? {}).forEach(add);
      element.children?.forEach(walk);
    };

    for (const root of [...(this.spec.layouts ?? []), ...this.spec.pages]) {
      add(root.class);
      root.body.forEach(walk);
    }

    return new Set(Object.keys(this.spec.classes ?? {}).filter(name => named.has(name)));
  }

  private classDeclaration(name: string, imports: FileImports): string {
    const rules: StyleSpec = this.spec.classes?.[name] ?? {};
    imports.values.add('styles');

    return `const ${this.classVariables.get(name) ?? camel(name)} = styles(${literal(name)}, ${literal(rules)});`;
  }

  private classReference(value: unknown, imports: FileImports): string {
    if (typeof value !== 'string') {
      return literal(value);
    }

    const variable = this.classVariables.get(value);
    if (!variable) {
      return literal(value);
    }

    // Split, every class is named from a page or a layout file, one folder below the shared `styles.ts`.
    if (this.options.split) {
      imports.local('../styles', variable);
    }

    return variable;
  }

  /**
   * A page or a layout: inline in the space, or — split — a file of its own the space imports.
   */
  private root(spec: PageSpec | LayoutSpec, type: 'PageSpec' | 'LayoutSpec', main: FileImports, path: string): string {
    const imports = this.options.split ? new FileImports() : main;

    const { body, ...fields } = spec;
    const parts = Object.entries(fields).map(([key, value]) =>
      key === 'class' ? `class: ${this.classReference(value, imports)}` : `${keyLiteral(key)}: ${literal(value)}`
    );
    parts.push(`body: [${body.map(child => this.element(child, imports)).join(', ')}]`);
    const object = `{ ${parts.join(', ')} }`;

    if (!this.options.split) {
      return object;
    }

    const variable = this.names.claim(withSuffix(camel(spec.id ?? path), type === 'PageSpec' ? 'Page' : 'Layout'));
    imports.types.add(type);
    this.files[`${path}.ts`] =
      `${imports.render(this.packageName)}\n\nexport const ${variable}: ${type} = ${object};\n`;
    main.local(`./${path}`, variable);

    return variable;
  }

  private element(spec: ElementSpec, imports: FileImports): string {
    const isFactory = FACTORY_NAMES.has(spec.type);
    const defaults = defaultAttributes(spec.type);
    const attributes = Object.fromEntries(
      Object.entries(spec.attributes ?? {}).filter(
        ([key, value]) => !(key in defaults && deepEqual(defaults[key], value))
      )
    );
    const label = spec.meta?.label;
    const meta = label !== undefined && label !== defaultLabel(spec.type) ? { label } : undefined;

    // An attribute named like an authoring field cannot be written flat; the spec's own shape says it plainly.
    if (Object.keys(attributes).some(key => AUTHORING_FIELDS.has(key))) {
      return this.literalElement(spec, attributes, meta, imports);
    }

    const content =
      isFactory && typeof attributes.content === 'string' && 'content' in defaults ? attributes.content : undefined;
    const props: string[] = [];
    if (spec.id !== undefined) {
      props.push(`id: ${literal(spec.id)}`);
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (!(content !== undefined && key === 'content')) {
        props.push(`${keyLiteral(key)}: ${literal(value)}`);
      }
    }

    props.push(...this.authoringFields(spec, meta, imports));
    const children =
      spec.children && spec.children.length > 0 ? spec.children.map(child => this.element(child, imports)) : undefined;
    // `factory(children)` and `factory(content)` are two signatures, never one: content with children takes props.
    const onlyChildren = props.length === 0 && children !== undefined && content === undefined;
    if (children && !onlyChildren) {
      props.push(`children: [${children.join(', ')}]`);
    } else if (spec.children && spec.children.length === 0) {
      props.push('children: []');
    }

    const propsLiteral = props.length > 0 ? `{ ${props.join(', ')} }` : '';
    const args = [
      ...(content !== undefined ? [literal(content)] : []),
      ...(onlyChildren ? [`[${children.join(', ')}]`] : []),
      ...(propsLiteral ? [propsLiteral] : [])
    ];

    if (isFactory) {
      imports.values.add(spec.type);

      return `${spec.type}(${args.join(', ')})`;
    }

    imports.values.add('element');
    const elementProps = [...props, ...(onlyChildren ? [`children: [${children.join(', ')}]`] : [])];

    return `element(${literal(spec.type)}${elementProps.length > 0 ? `, { ${elementProps.join(', ')} }` : ''})`;
  }

  private authoringFields(spec: ElementSpec, meta: { label: string } | undefined, imports: FileImports): string[] {
    const fields = ELEMENT_FIELDS.flatMap(key => {
      if (STRUCTURAL_FIELDS.has(key) || spec[key] === undefined) {
        return [];
      }

      if (key === 'class') {
        return [`class: ${this.classReference(spec.class, imports)}`];
      }

      if (key === 'slots') {
        const slots = Object.entries(spec.slots ?? {}).map(
          ([slot, value]) => `${keyLiteral(slot)}: ${this.classReference(value, imports)}`
        );

        return [`slots: { ${slots.join(', ')} }`];
      }

      return [`${key}: ${literal(spec[key])}`];
    });

    return meta ? [...fields, `meta: ${literal(meta)}`] : fields;
  }

  private literalElement(
    spec: ElementSpec,
    attributes: Record<string, unknown>,
    meta: { label: string } | undefined,
    imports: FileImports
  ): string {
    const fields = [
      `type: ${literal(spec.type)}`,
      ...(spec.id === undefined ? [] : [`id: ${literal(spec.id)}`]),
      `attributes: ${literal({ ...defaultAttributes(spec.type), ...attributes })}`,
      ...this.authoringFields(spec, meta ?? { label: defaultLabel(spec.type) }, imports),
      ...(spec.children ? [`children: [${spec.children.map(child => this.element(child, imports)).join(', ')}]`] : [])
    ];

    return `{ ${fields.join(', ')} }`;
  }
}

/** Writes a spec out as source files. See {@link SpecSourceOptions}. */
export const specToSource = (spec: SpaceSpec, options: SpecSourceOptions): SpecSourceFiles =>
  new SourceWriter(spec, options).write();
