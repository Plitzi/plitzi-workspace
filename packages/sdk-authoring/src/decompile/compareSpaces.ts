import { defaultAttributes } from '../elements';
import { BREAKPOINTS, expandShorthand } from '../style';
import { categoryOf, definitionOf, isRecord } from './documents';

import type { SpaceDocuments } from '../schema';
import type {
  Element,
  ElementInteraction,
  Schema,
  Style,
  StyleBlock,
  StyleItem,
  StyleObject
} from '@plitzi/sdk-shared';

/**
 * Whether two pairs of space documents render the same space.
 *
 * Not whether they are the same bytes: a selector used by one element is free to be renamed, a binding's id is
 * derived from its position, an attribute left out means its default, and an element nothing refers to may be
 * called anything. What has to agree is everything a visitor or another part of the document can observe — the
 * tree, every attribute, the rules that apply to each element (whatever the selector holding them is called), the
 * bindings, the flows, the pages, the layouts and the settings.
 *
 * Elements are paired by position, so an element renamed on the way through is still compared with itself.
 */

export interface SpaceDifference {
  /** Where, by the ids of the FIRST pair: `home > hero > title`, `style: card`, `settings.customCss`. */
  at: string;
  message: string;
}

type Canonical = null | boolean | number | string | Canonical[] | { [key: string]: Canonical };

/** A value with its keys sorted and its empty parts removed, so two ways of saying nothing agree. */
const canonical = (value: unknown): Canonical => {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, inner]) => [key, canonical(inner)] as const)
      .filter(([, inner]) => inner !== null && !(isRecord(inner) && Object.keys(inner).length === 0))
      .sort(([a], [b]) => a.localeCompare(b));

    return Object.fromEntries(entries);
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  // A document is JSON: nothing else — a function, a symbol — can be in one to compare.
  return null;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const describe = (value: unknown): string => {
  const text = JSON.stringify(canonical(value));

  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
};

/** Rules as the editor reads them: shorthands expanded, empty values dropped, numbers and strings as written. */
const rulesOf = (rules: StyleObject | undefined): Record<string, string> =>
  Object.fromEntries(
    Object.entries(expandShorthand(rules ?? {}))
      .filter(([, value]) => value !== '')
      .map(([property, value]) => [property, String(value)])
  );

const blockOf = (block: StyleBlock | undefined): unknown =>
  block && {
    default: rulesOf(block.default),
    states: Object.fromEntries(Object.entries(block.states ?? {}).map(([state, rules]) => [state, rulesOf(rules)])),
    variants: Object.fromEntries(
      Object.entries(block.variants ?? {}).map(([name, variant]) => [
        name,
        {
          default: rulesOf(variant.default),
          states: Object.fromEntries(
            Object.entries(variant.states ?? {}).map(([state, rules]) => [state, rulesOf(rules)])
          )
        }
      ])
    )
  };

/**
 * A class and its legacy `name:state` companions, per breakpoint — what applies to an element naming the class.
 *
 * A selector the style does not define resolves to no rules at all, which is exactly what the element renders with.
 */
const classRules = (style: Style, name: string | undefined): unknown => {
  if (!name) {
    return {};
  }

  return Object.fromEntries(
    BREAKPOINTS.map(breakpoint => {
      const items = style.platform[breakpoint];
      const item = items[name] as StyleItem | undefined;
      const states = Object.values(items)
        .filter(candidate => candidate.name.startsWith(`${name}:`))
        .map(candidate => [candidate.name.slice(name.length + 1), candidate.attributes.base.default] as const);
      const block: StyleBlock | undefined =
        item || states.length > 0
          ? {
              default: item?.attributes.base.default ?? {},
              states: { ...item?.attributes.base.states, ...Object.fromEntries(states) },
              variants: item?.attributes.base.variants
            }
          : undefined;

      return [breakpoint, blockOf(block)];
    })
  );
};

const bindingsOf = (element: Element): unknown => {
  const stored: unknown = element.definition.bindings;
  if (!isRecord(stored)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(stored).map(([category, list]) => [
      category,
      (Array.isArray(list) ? list : [])
        .filter(isRecord)
        .map(binding => ({
          source: binding.source,
          to: binding.to,
          transformers: Array.isArray(binding.transformers) ? binding.transformers : [],
          when:
            isRecord(binding.when) && Array.isArray(binding.when.rules) && binding.when.rules.length > 0
              ? binding.when
              : null,
          enabled: binding.enabled !== false
        }))
        .map(binding => JSON.stringify(canonical(binding)))
        .sort()
    ])
  );
};

const flowsOf = (element: Element): unknown => {
  const nodes: Record<string, ElementInteraction> = element.definition.interactions ?? {};

  return Object.values(nodes)
    .filter(node => !node.beforeNode || !Object.hasOwn(nodes, node.beforeNode))
    .map(head => {
      const chain: unknown[] = [];
      const seen = new Set<string>();
      for (let current: ElementInteraction | undefined = head; current && !seen.has(current.id);) {
        seen.add(current.id);
        chain.push({
          id: current.id,
          type: current.type,
          action: current.action,
          title: current.title,
          params: current.params,
          preview: current.preview,
          // The element a trigger sits on is the element itself, whatever it happens to be called.
          elementId: current.elementId === element.id ? 'self' : current.elementId || null,
          when:
            isRecord(current.when) && Array.isArray(current.when.rules) && current.when.rules.length > 0
              ? current.when
              : null,
          enabled: current.enabled
        });
        current = current.afterNode && Object.hasOwn(nodes, current.afterNode) ? nodes[current.afterNode] : undefined;
      }

      return chain;
    });
};

/** What a page means when it says nothing: switched on, and with no SEO block of its own. */
const PAGE_UNSET: Record<string, unknown> = { enabled: true, seoEnabled: false };

/**
 * Attributes as the element reads them: its type's defaults under what it stores, with the ways of saying "not set"
 * — an empty string, and a page's {@link PAGE_UNSET} — made one.
 *
 * Not a page's defaults: those are the builder's placeholders for a NEW page (`seoPageTitle: 'Title'`), and a page is
 * never written through a factory that would put them back.
 */
const attributesOf = (element: Element): unknown => {
  const isPage = element.definition.type === 'page';
  const defaults = isPage ? {} : defaultAttributes(element.definition.type);
  // An older builder's two ways of saying "not set" — null, and an empty list where the element keeps a record —
  // both mean the default, which is what the element falls back to.
  const stored = Object.entries(isRecord(element.attributes) ? element.attributes : {}).filter(
    ([key, value]) => value !== null && !(Array.isArray(value) && value.length === 0 && isRecord(defaults[key]))
  );

  return Object.fromEntries(
    Object.entries({ ...defaults, ...Object.fromEntries(stored) }).filter(
      ([key, value]) => value !== '' && !(isPage && Object.hasOwn(PAGE_UNSET, key) && PAGE_UNSET[key] === value)
    )
  );
};

const styleVariantOf = (element: Element): unknown => element.definition.initialState?.styleVariant ?? null;

class SpaceComparer {
  private readonly differences: SpaceDifference[] = [];

  constructor(
    private readonly expected: SpaceDocuments,
    private readonly actual: SpaceDocuments
  ) {}

  compare(): SpaceDifference[] {
    this.compareSettings();
    this.compareElementStyles();
    this.compareRoots();

    return this.differences;
  }

  private differ(at: string, message: string): void {
    this.differences.push({ at, message });
  }

  private check(at: string, what: string, expected: unknown, actual: unknown): void {
    if (!same(expected, actual)) {
      this.differ(at, `${what}: expected ${describe(expected)}, got ${describe(actual)}`);
    }
  }

  private compareSettings(): void {
    const [a, b] = [this.expected, this.actual];
    const [definitionA, definitionB] = [definitionOf(a.schema), definitionOf(b.schema)];
    this.check('schema', 'name', definitionA.name, definitionB.name);
    this.check('schema', 'permanent URL', definitionA.permanentUrl, definitionB.permanentUrl);
    const variables = (schema: Schema): unknown =>
      schema.variables.map(variable => ({ ...variable, category: categoryOf(variable) }));
    this.check('schema', 'variables', variables(a.schema), variables(b.schema));
    this.check('schema', 'rsc', a.schema.rsc, b.schema.rsc);

    // An empty string is the builder's way of leaving a setting unset.
    const setOnly = (settings: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== ''));
    const { customCss: cssA, ...settingsA } = a.schema.settings;
    const { customCss: cssB, ...settingsB } = b.schema.settings;
    this.check('settings', 'settings', setOnly(settingsA), setOnly(settingsB));
    if (cssA.trim() !== cssB.trim()) {
      const kept = cssB.startsWith(cssA.trim())
        ? ` (the same, with ${cssB.length - cssA.trim().length} characters added)`
        : '';
      this.differ('settings.customCss', `custom CSS differs${kept}`);
    }

    const folders = (schema: SpaceDocuments['schema']): unknown =>
      schema.pageFolders.map(folder => ({ ...folder, parentId: folder.parentId || null }));
    this.check('schema', 'page folders', folders(a.schema), folders(b.schema));
    this.check('style', 'mode', a.style.mode, b.style.mode);
    this.check('style', 'theme', a.style.theme, b.style.theme);
    this.check('style', 'variables', a.style.variables, b.style.variables);
    this.check('style', 'fonts', a.style.fonts ?? [], b.style.fonts ?? []);
  }

  /** Per element type, and every class nothing in the tree names — neither can be paired through an element. */
  private compareElementStyles(): void {
    const elementTypes = (style: Style): Set<string> =>
      new Set(
        BREAKPOINTS.flatMap(breakpoint =>
          Object.values(style.platform[breakpoint])
            .filter(item => item.type === 'element')
            .map(item => item.componentType ?? item.name)
        )
      );

    const typeStyle = (style: Style, type: string): unknown =>
      Object.fromEntries(
        BREAKPOINTS.map(breakpoint => {
          const item = Object.values(style.platform[breakpoint]).find(
            candidate => candidate.type === 'element' && (candidate.componentType ?? candidate.name) === type
          );

          return [
            breakpoint,
            item && Object.fromEntries(Object.entries(item.attributes).map(([slot, block]) => [slot, blockOf(block)]))
          ];
        })
      );

    for (const type of new Set([...elementTypes(this.expected.style), ...elementTypes(this.actual.style)])) {
      this.check(
        `style: ${type}`,
        'element type rules',
        typeStyle(this.expected.style, type),
        typeStyle(this.actual.style, type)
      );
    }

    const named = (documents: SpaceDocuments): Set<string> =>
      new Set(
        Object.values(documents.schema.flat).flatMap(element => Object.values(element.definition.styleSelectors))
      );
    const unnamed = (documents: SpaceDocuments): string[] => {
      const used = named(documents);

      return [
        ...new Set(
          BREAKPOINTS.flatMap(breakpoint =>
            Object.values(documents.style.platform[breakpoint])
              .filter(item => item.type === 'class' && !used.has(item.name))
              .map(item => item.name)
          )
        )
      ];
    };

    for (const name of new Set([...unnamed(this.expected), ...unnamed(this.actual)])) {
      this.check(
        `style: ${name}`,
        'unused class',
        classRules(this.expected.style, name),
        classRules(this.actual.style, name)
      );
    }
  }

  private compareRoots(): void {
    const roots = (documents: SpaceDocuments): Element[] => {
      const pages = documents.schema.pages.flatMap(id =>
        Object.hasOwn(documents.schema.flat, id) ? [documents.schema.flat[id]] : []
      );
      const layouts = Object.values(documents.schema.flat)
        .filter(
          element =>
            !element.definition.parentId &&
            element.definition.type === 'layoutContainer' &&
            !documents.schema.pages.includes(element.id)
        )
        .sort((x, y) => x.id.localeCompare(y.id));

      return [...layouts, ...pages];
    };

    const expectedRoots = roots(this.expected);
    const actualRoots = roots(this.actual);
    this.check(
      'schema',
      'roots',
      expectedRoots.map(root => root.id),
      actualRoots.map(root => root.id)
    );
    expectedRoots.forEach((root, index) => {
      if (index < actualRoots.length) {
        this.compareElement(root, actualRoots[index], root.id);
      }
    });
  }

  private childrenOf(documents: SpaceDocuments, element: Element): Element[] {
    return (element.definition.items ?? []).flatMap(id =>
      Object.hasOwn(documents.schema.flat, id) ? [documents.schema.flat[id]] : []
    );
  }

  private compareElement(a: Element, b: Element, at: string): void {
    const isPage = this.expected.schema.pages.includes(a.id);
    this.check(at, 'type', a.definition.type, b.definition.type);
    this.check(at, 'label', isPage ? 'Page' : a.definition.label, isPage ? 'Page' : b.definition.label);
    this.check(at, 'attributes', attributesOf(a), attributesOf(b));

    const slots = new Set([...Object.keys(a.definition.styleSelectors), ...Object.keys(b.definition.styleSelectors)]);
    for (const slot of slots) {
      this.check(
        at,
        `rules of ${slot}`,
        classRules(this.expected.style, a.definition.styleSelectors[slot]),
        classRules(this.actual.style, b.definition.styleSelectors[slot])
      );
    }

    this.check(
      at,
      'visibility',
      a.definition.initialState?.visibility !== false,
      b.definition.initialState?.visibility !== false
    );
    this.check(at, 'style variant', styleVariantOf(a), styleVariantOf(b));
    this.check(at, 'bindings', bindingsOf(a), bindingsOf(b));
    this.check(at, 'flows', flowsOf(a), flowsOf(b));
    this.check(at, 'runtime', a.definition.runtime, b.definition.runtime);
    this.check(at, 'load strategy', a.definition.loadStrategy, b.definition.loadStrategy);

    const childrenA = this.childrenOf(this.expected, a);
    const childrenB = this.childrenOf(this.actual, b);
    if (childrenA.length !== childrenB.length) {
      this.differ(at, `children: expected ${childrenA.length}, got ${childrenB.length}`);
    }

    childrenA.forEach((child, index) => {
      if (index < childrenB.length) {
        this.compareElement(child, childrenB[index], `${at} > ${child.id}`);
      }
    });
  }
}

/** Every observable way `actual` differs from `expected`. Empty means they render the same space. */
export const compareSpaces = (expected: SpaceDocuments, actual: SpaceDocuments): SpaceDifference[] =>
  new SpaceComparer(expected, actual).compare();
