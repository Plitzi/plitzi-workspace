import { unusedDeclarations } from '@plitzi/sdk-authoring';
import { isInstance } from '@plitzi/sdk-schema/helpers/components';
import { GLOBAL_SOURCES } from '@plitzi/sdk-shared/dataSource/globalSources';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { hasValidToken, templatePaths } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { rootName } from '@pmodules/Builder/helpers/searchElements';
import { componentLabel } from '@pmodules/Components/helpers';

import type { Element, Schema, Style, StyleItem, StyleVariableValue } from '@plitzi/sdk-shared';

export type UsageCategory = 'components' | 'classes' | 'variables' | 'dataSources';

export type UsageTreeKind = 'page' | 'layout' | 'component';

/** A tree of the document an element lives in: a page or a layout of `schema.flat`, or a component's own `flat`. */
export type UsageTree = { kind: UsageTreeKind; id: string; label: string };

/** One element that uses an item, and in which ways — `var(--brand) in .btn`, `apiContainer_products.data`. */
export type ElementUsage = {
  elementId: string;
  elementType: string;
  /** Free display text, only when it says something the id does not. */
  label?: string;
  tree: UsageTree;
  via: string[];
};

/** A use that is not an element: a selector, another token, the space's custom CSS, a computed value. */
export type SpaceReference = { kind: 'selector' | 'variable' | 'customCss' | 'computed'; name: string };

export type UsageItem = {
  /** Unique across the whole index: `component:card`, `class:btn`, `token:color:brand`, `source:state`. */
  key: string;
  name: string;
  /** What it is within its category: a token's group, `space variable`, a provider's source prefix, `global`. */
  detail: string;
  /** The element that declares it, where one does: a component's root, a data source's provider. */
  owner?: ElementUsage;
  elements: ElementUsage[];
  references: SpaceReference[];
  /**
   * Declared and used by nothing the space holds. For a class, a token or a component this is sdk-authoring's rule —
   * the one its `unused-*` suggestions follow — which is more generous than `elements` and `references`: a class
   * named as a word anywhere, in prose included, is not called unused.
   */
  unused: boolean;
};

export type UsageIndex = Record<UsageCategory, UsageItem[]>;

export type UsageSource = {
  schema: Schema;
  style: Pick<Style, 'platform' | 'variables' | 'fonts'>;
  /**
   * Element type → the prefix the source it publishes is named under (`{ apiContainer: 'apiContainer' }`). A provider
   * of these types is listed even when nothing reads it; any other element is listed as a source once something does.
   */
  providerTypes?: Readonly<Record<string, string>>;
};

/** With or without a fallback: `var(--gap, 8px)` still reads `--gap` whenever it is declared. */
const VAR_REFERENCE = /var\(\s*--([\w-]+)/g;
/** What `processCssTokens` substitutes in the style cache: a space variable, by name. */
const CSS_TOKEN = /\{\{\s*([a-z0-9_\-.$]+)\s*\}\}/gi;

const GLOBAL_NAMES: ReadonlySet<string> = new Set(GLOBAL_SOURCES);

/** What one element reads, worn and places — intrinsic to the element, so kept for as long as the element object is. */
type ElementReads = {
  instanceOf?: string;
  classes: Set<string>;
  paths: Set<string>;
  cssVariables: Set<string>;
};

/** What one selector reads: the `var(--x)` of its rules and its own variables, and the `{{ x }}` space variables. */
type SelectorReads = { cssVariables: Set<string>; cssTokens: Set<string> };

const elementReadsCache = new WeakMap<Element, ElementReads>();
const selectorReadsCache = new WeakMap<StyleItem, SelectorReads>();

const addWords = (text: string, into: Set<string>): void => {
  for (const word of text.split(/\s+/)) {
    if (word) {
      into.add(word);
    }
  }
};

const scanText = (text: string, reads: Pick<ElementReads, 'paths' | 'cssVariables'>): void => {
  for (const [, name] of text.matchAll(VAR_REFERENCE)) {
    reads.cssVariables.add(name);
  }

  if (hasValidToken(text)) {
    for (const path of templatePaths(text)) {
      reads.paths.add(path);
    }
  }
};

/**
 * Every string under `value`, read for templates and `var()`; every `styleSelectors` record for the classes it puts on
 * an element (a step's `setState` as much as the definition's own); every query rule for the field it compares.
 */
const scanValue = (value: unknown, reads: ElementReads): void => {
  if (typeof value === 'string') {
    scanText(value, reads);

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      scanValue(item, reads);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.field === 'string' && 'operator' in value) {
    reads.paths.add(value.field);
    if (value.isBinding === true && typeof value.value === 'string') {
      reads.paths.add(value.value);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'styleSelectors' && isRecord(child)) {
      for (const selectors of Object.values(child)) {
        if (typeof selectors === 'string') {
          addWords(selectors, reads.classes);
        }
      }
    }

    scanValue(child, reads);
  }
};

const readElement = (element: Element): ElementReads => {
  const { attributes, definition } = element;
  const reads: ElementReads = { classes: new Set(), paths: new Set(), cssVariables: new Set() };
  const { referenceId } = attributes;
  if (isInstance(element) && typeof referenceId === 'string') {
    reads.instanceOf = referenceId;
  }

  for (const selectors of Object.values(definition.styleSelectors)) {
    addWords(selectors, reads.classes);
  }

  for (const binding of Object.values(definition.bindings ?? {}).flat()) {
    if (binding.source) {
      reads.paths.add(binding.source);
    }

    scanValue(binding.when, reads);
    for (const { action, params } of binding.transformers ?? []) {
      scanValue(params, reads);
      if (action === 'styleSelector' && typeof params.selector === 'string') {
        addWords(params.selector, reads.classes);
      }
    }
  }

  for (const interaction of Object.values(definition.interactions ?? {})) {
    scanValue(interaction.params, reads);
    scanValue(interaction.when, reads);
  }

  scanValue(attributes, reads);
  scanValue(definition.initialState, reads);
  if (definition.flag) {
    reads.paths.add(`flags.${definition.flag.name}`);
  }

  // A transformer's template reads the bound value as `source`, which names no source of the space.
  for (const path of reads.paths) {
    if (path === 'source' || path.startsWith('source.')) {
      reads.paths.delete(path);
    }
  }

  return reads;
};

const readsOf = (element: Element): ElementReads => {
  let reads = elementReadsCache.get(element);
  if (!reads) {
    reads = readElement(element);
    elementReadsCache.set(element, reads);
  }

  return reads;
};

const scanStyleValue = (value: unknown, reads: SelectorReads): void => {
  if (typeof value === 'string') {
    for (const [, name] of value.matchAll(VAR_REFERENCE)) {
      reads.cssVariables.add(name);
    }

    for (const [, path] of value.matchAll(CSS_TOKEN)) {
      reads.cssTokens.add(path.split('.')[0]);
    }

    return;
  }

  if (Array.isArray(value) || isRecord(value)) {
    for (const child of Object.values(value)) {
      scanStyleValue(child, reads);
    }
  }
};

const selectorReadsOf = (item: StyleItem): SelectorReads => {
  let reads = selectorReadsCache.get(item);
  if (!reads) {
    reads = { cssVariables: new Set(), cssTokens: new Set() };
    scanStyleValue(item.attributes, reads);
    scanStyleValue(item.variables, reads);
    selectorReadsCache.set(item, reads);
  }

  return reads;
};

const themeValueTexts = (value: StyleVariableValue): string[] =>
  typeof value === 'object' ? Object.values(value) : [String(value)];

/** A selector as an author writes it: `.btn` for a class, the bare name for an element or type selector. */
const selectorLabel = (item: StyleItem): string => (item.type === 'class' ? `.${item.name}` : item.name);

type Located = { element: Element; tree: UsageTree };

const elementUsage = (element: Element, tree: UsageTree, via: string[]): ElementUsage => {
  const { label } = element.definition;

  return {
    elementId: element.id,
    elementType: element.definition.type,
    label: label && label.toLowerCase() !== element.id.toLowerCase() ? label : undefined,
    tree,
    via
  };
};

/** Collects uses item by item, each element once per item however many ways it uses it. */
class UsageCollector {
  readonly byCategory: UsageIndex = { components: [], classes: [], variables: [], dataSources: [] };
  private readonly items = new Map<string, UsageItem>();
  private readonly elementUses = new Map<string, Map<string, ElementUsage>>();
  private readonly referenceKeys = new Map<string, Set<string>>();

  /** Lists an item once: asking again for a key already listed keeps the first. */
  add(category: UsageCategory, item: Omit<UsageItem, 'elements' | 'references' | 'unused'>): void {
    if (!this.items.has(item.key)) {
      const added: UsageItem = { ...item, elements: [], references: [], unused: false };
      this.items.set(item.key, added);
      this.byCategory[category].push(added);
    }
  }

  useByElement(key: string, { element, tree }: Located, via: string): void {
    const item = this.items.get(key);
    if (!item) {
      return;
    }

    let uses = this.elementUses.get(key);
    if (!uses) {
      uses = new Map();
      this.elementUses.set(key, uses);
    }

    const existing = uses.get(element.id);
    if (existing) {
      if (!existing.via.includes(via)) {
        existing.via.push(via);
      }

      return;
    }

    const usage = elementUsage(element, tree, [via]);
    uses.set(element.id, usage);
    item.elements.push(usage);
  }

  useBySpace(key: string, reference: SpaceReference): void {
    const item = this.items.get(key);
    if (!item) {
      return;
    }

    let seen = this.referenceKeys.get(key);
    if (!seen) {
      seen = new Set();
      this.referenceKeys.set(key, seen);
    }

    const referenceKey = `${reference.kind}:${reference.name}`;
    if (!seen.has(referenceKey)) {
      seen.add(referenceKey);
      item.references.push(reference);
    }
  }
}

/**
 * Every element of the document with the tree it lives in, pages and layouts first, then each component.
 *
 * While a component is open the builder lays its tree over the pages' `flat`, so an element a component holds is
 * taken from the component — never twice, never as part of a page.
 */
const locateElements = (flat: Schema['flat'], components: Schema['components']): Located[] => {
  const owned = new Set<string>();
  for (const component of Object.values(components)) {
    for (const id of Object.keys(component.flat)) {
      owned.add(id);
    }
  }

  const trees = new Map<string, UsageTree>();
  const rootOf = new Map<string, string>();
  // Walked through `parentId`, as the tree is, and remembered for every element on the way: one walk per branch.
  const findRoot = (id: string): string => {
    const visited: string[] = [];
    let current = id;
    let root = rootOf.get(current);
    while (root === undefined) {
      visited.push(current);
      const { parentId } = flat[current].definition;
      if (!parentId || !Object.hasOwn(flat, parentId) || visited.includes(parentId)) {
        root = current;
      } else {
        current = parentId;
        root = rootOf.get(current);
      }
    }

    for (const step of visited) {
      rootOf.set(step, root);
    }

    return root;
  };

  const treeOfRoot = (rootId: string): UsageTree => {
    let tree = trees.get(rootId);
    if (!tree) {
      const kind = flat[rootId].definition.type === 'layoutContainer' ? 'layout' : 'page';
      tree = { kind, id: rootId, label: rootName(flat, rootId) };
      trees.set(rootId, tree);
    }

    return tree;
  };

  const located: Located[] = [];
  for (const element of Object.values(flat)) {
    if (!owned.has(element.id)) {
      located.push({ element, tree: treeOfRoot(findRoot(element.id)) });
    }
  }

  for (const component of Object.values(components)) {
    const tree: UsageTree = { kind: 'component', id: component.id, label: componentLabel(component) };
    for (const element of Object.values(component.flat)) {
      located.push({ element, tree });
    }
  }

  return located;
};

const byName = (a: UsageItem, b: UsageItem): number => a.name.localeCompare(b.name);

/**
 * Where everything the space declares is used: each component's instances, the elements wearing each class, what
 * reads each style token and space variable, and what binds to each data source — in one pass over the document.
 *
 * Reads only what is written down. A class added by a plugin at run time, a token a plugin's own stylesheet reads, a
 * source a template assembles from pieces: none of them can be seen from the document, so an item with no uses is
 * one nothing in the SPACE uses.
 */
export const buildUsageIndex = (source: UsageSource): UsageIndex => {
  const { schema, style } = source;
  const { flat, components, variables } = schema;
  const { computed = {}, customCss } = schema.settings;
  const { platform: stylePlatform, variables: styleVariables } = style;
  const providerTypes = source.providerTypes ?? {};
  const collector = new UsageCollector();
  const located = locateElements(flat, components);
  const locatedById = new Map(located.map(entry => [entry.element.id, entry]));

  for (const component of Object.values(components).sort((a, b) =>
    componentLabel(a).localeCompare(componentLabel(b))
  )) {
    const root = Object.hasOwn(component.flat, component.rootId) ? component.flat[component.rootId] : undefined;
    const tree: UsageTree = { kind: 'component', id: component.id, label: componentLabel(component) };
    collector.add('components', {
      key: `component:${component.id}`,
      name: componentLabel(component),
      detail: component.id,
      owner: root ? elementUsage(root, tree, []) : undefined
    });
  }

  const classDisplayModes = new Map<string, string[]>();
  for (const [displayMode, items] of Object.entries(stylePlatform)) {
    for (const item of Object.values(items)) {
      if (item.type === 'class') {
        classDisplayModes.set(item.name, [...(classDisplayModes.get(item.name) ?? []), displayMode]);
      }
    }
  }

  for (const name of [...classDisplayModes.keys()].sort()) {
    collector.add('classes', { key: `class:${name}`, name, detail: (classDisplayModes.get(name) ?? []).join(', ') });
  }

  const tokenKeys = new Map<string, string[]>();
  for (const [category, group] of Object.entries(styleVariables)) {
    for (const name of Object.keys(group).sort()) {
      const key = `token:${category}:${name}`;
      collector.add('variables', { key, name, detail: category });
      tokenKeys.set(name, [...(tokenKeys.get(name) ?? []), key]);
    }
  }

  const schemaVariableKeys = new Map<string, string>();
  for (const { name } of [...variables].sort((a, b) => a.name.localeCompare(b.name))) {
    const key = `variable:${name}`;
    collector.add('variables', { key, name, detail: 'space variable' });
    schemaVariableKeys.set(name, key);
  }

  /** The keys `var(--name)` reads: a style token, and a space variable — both are written to the page as `--name`. */
  const cssVariableKeys = (name: string): string[] => {
    const schemaKey = schemaVariableKeys.get(name);

    return schemaKey ? [...(tokenKeys.get(name) ?? []), schemaKey] : (tokenKeys.get(name) ?? []);
  };

  for (const entry of located) {
    const prefix = providerTypes[entry.element.definition.type];
    if (prefix) {
      collector.add('dataSources', {
        key: `source:${prefix}_${entry.element.id}`,
        name: entry.element.id,
        detail: prefix,
        owner: elementUsage(entry.element, entry.tree, [])
      });
    }
  }

  /** The item a path a template or a binding reads belongs to, if any: a space variable, or a data source. */
  const keyOfPath = (path: string): string | undefined => {
    const [root, field] = path.split('.');
    if (root === 'variables') {
      return field ? schemaVariableKeys.get(field) : undefined;
    }

    if (GLOBAL_NAMES.has(root)) {
      const key = `source:${root}`;
      collector.add('dataSources', { key, name: root, detail: 'global' });

      return key;
    }

    // An attribute's template reads the space variables by their bare name too: `{{ apiUrl }}`.
    const bareVariable = schemaVariableKeys.get(root);
    if (bareVariable) {
      return bareVariable;
    }

    const separator = root.indexOf('_');
    const provider = separator > 0 ? locatedById.get(root.slice(separator + 1)) : undefined;
    if (provider) {
      const key = `source:${root}`;
      collector.add('dataSources', {
        key,
        name: provider.element.id,
        detail: root.slice(0, separator),
        owner: elementUsage(provider.element, provider.tree, [])
      });

      return key;
    }

    return undefined;
  };

  const classWearers = new Map<string, Located[]>();
  const typeMembers = new Map<string, Located[]>();
  const addTo = (map: Map<string, Located[]>, name: string, entry: Located): void => {
    const list = map.get(name);
    if (list) {
      list.push(entry);
    } else {
      map.set(name, [entry]);
    }
  };

  for (const entry of located) {
    const { element } = entry;
    const reads = readsOf(element);
    if (reads.instanceOf) {
      collector.useByElement(`component:${reads.instanceOf}`, entry, 'instance');
    }

    for (const name of reads.classes) {
      addTo(classWearers, name, entry);
      collector.useByElement(`class:${name}`, entry, `.${name}`);
    }

    addTo(typeMembers, element.definition.type, entry);
    const { subType } = element.attributes;
    if (typeof subType === 'string' && subType && subType !== element.definition.type) {
      addTo(typeMembers, subType, entry);
    }

    for (const path of reads.paths) {
      const key = keyOfPath(path);
      if (key) {
        collector.useByElement(key, entry, path);
      }
    }

    for (const name of reads.cssVariables) {
      for (const key of cssVariableKeys(name)) {
        collector.useByElement(key, entry, `var(--${name})`);
      }
    }
  }

  /** The elements a selector dresses: a class's wearers, the element its id names, every element of its type. */
  const dressedBy = (item: StyleItem): Located[] => {
    if (item.type === 'class') {
      return classWearers.get(item.name) ?? [];
    }

    if (item.type === 'id') {
      const entry = locatedById.get(item.name);

      return entry ? [entry] : [];
    }

    return typeMembers.get(item.componentType ?? item.name) ?? [];
  };

  for (const items of Object.values(stylePlatform)) {
    for (const item of Object.values(items)) {
      const { cssVariables, cssTokens } = selectorReadsOf(item);
      if (cssVariables.size === 0 && cssTokens.size === 0) {
        continue;
      }

      const label = selectorLabel(item);
      const dressed = dressedBy(item);
      const reads = [
        ...[...cssVariables].flatMap(name =>
          cssVariableKeys(name).map(key => ({ key, via: `var(--${name}) in ${label}` }))
        ),
        ...[...cssTokens].flatMap(name => {
          const key = schemaVariableKeys.get(name);

          return key ? [{ key, via: `{{ ${name} }} in ${label}` }] : [];
        })
      ];
      for (const { key, via } of reads) {
        collector.useBySpace(key, { kind: 'selector', name: label });
        for (const entry of dressed) {
          collector.useByElement(key, entry, via);
        }
      }
    }
  }

  for (const group of Object.values(styleVariables)) {
    for (const [name, value] of Object.entries(group)) {
      for (const text of themeValueTexts(value)) {
        for (const [, read] of text.matchAll(VAR_REFERENCE)) {
          if (read !== name) {
            for (const key of cssVariableKeys(read)) {
              collector.useBySpace(key, { kind: 'variable', name: `--${name}` });
            }
          }
        }
      }
    }
  }

  for (const [, name] of customCss.matchAll(VAR_REFERENCE)) {
    for (const key of cssVariableKeys(name)) {
      collector.useBySpace(key, { kind: 'customCss', name: 'Custom CSS' });
    }
  }

  for (const [name, template] of Object.entries(computed)) {
    for (const path of templatePaths(template)) {
      const key = keyOfPath(path);
      if (key) {
        collector.useBySpace(key, { kind: 'computed', name: `computed.${name}` });
      }
    }
  }

  const { byCategory } = collector;
  // Authoring's rule, so the panel and the suggestions never disagree on what nothing uses.
  const unused = unusedDeclarations(schema, style);
  const unusedTokens = new Set(unused.tokens);
  const declaredUnusedKeys = new Set([
    ...unused.components.map(id => `component:${id}`),
    ...unused.classes.map(name => `class:${name}`)
  ]);
  const isDeclaredUnused = (item: UsageItem): boolean =>
    item.key.startsWith('token:') ? unusedTokens.has(item.name) : declaredUnusedKeys.has(item.key);
  const nothingUses = (item: UsageItem): boolean => item.elements.length === 0 && item.references.length === 0;
  for (const item of [...byCategory.components, ...byCategory.classes, ...byCategory.variables]) {
    item.unused = item.key.startsWith('variable:') ? nothingUses(item) : isDeclaredUnused(item);
  }

  for (const item of byCategory.dataSources) {
    item.unused = nothingUses(item);
  }

  return {
    components: byCategory.components,
    classes: byCategory.classes,
    variables: byCategory.variables,
    dataSources: [
      ...byCategory.dataSources.filter(item => item.detail !== 'global').sort(byName),
      ...byCategory.dataSources.filter(item => item.detail === 'global').sort(byName)
    ]
  };
};

/** Declared, and used by nothing the space holds: a candidate to remove. */
export const isUnused = (item: UsageItem): boolean => item.unused;

let lastSource: UsageSource | undefined;
let lastIndex: UsageIndex | undefined;

const SOURCE_FIELDS: (keyof UsageSource)[] = ['schema', 'style', 'providerTypes'];

/**
 * `buildUsageIndex`, kept for the last document it was asked about: every reader of the same schema and style shares
 * one index, and an edit rebuilds it reading again only the elements and selectors that changed — those are new
 * objects, every other one is the object it was.
 */
export const usageIndexOf = (source: UsageSource): UsageIndex => {
  const previous = lastSource;
  if (lastIndex && previous && SOURCE_FIELDS.every(field => previous[field] === source[field])) {
    return lastIndex;
  }

  lastIndex = buildUsageIndex(source);
  lastSource = source;

  return lastIndex;
};
