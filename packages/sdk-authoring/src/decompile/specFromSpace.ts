import { defaultAttributes, elementAttributeNames, elementSourceTypes } from '../elements';
import { BUILTIN_GLOBAL_CALLBACKS } from '../interactions';
import { authorFlows, GLOBAL_SOURCES } from '../schema';
import { css } from '../style';
import { foldCustomCss } from './customCss';
import { categoryOf, definitionOf, isRecord } from './documents';
import { readSelector, unwritableCss } from './styles';

import type {
  BindingSpec,
  ElementSpec,
  LayoutRef,
  LayoutSpec,
  PageFolderSpec,
  PageSpec,
  SpaceDocuments,
  SpaceSpec,
  StepSpec
} from '../schema';
import type { CssProps, CssSpec, StatesSpec, StyleSpec } from '../style';
import type { ReadSelector, SelectorBlocks, UnwritableRules } from './styles';
import type {
  BindingCategory,
  Element,
  ElementBinding,
  ElementInteraction,
  Schema,
  Style,
  StyleBlock
} from '@plitzi/sdk-shared';

/** The class names a selector joins with a space — one for most, several where the builder stacked them. */
const classesOf = (selector: string): string[] => selector.split(/\s+/).filter(Boolean);

/**
 * A space document, read back into the declaration that would author it.
 *
 * `authorSpace` turns a spec into documents and derives every id, selector name and back-reference on the way. This
 * is the other direction: it reads the documents and keeps only what a person decided, so the result can be written
 * out as code and authored again. What comes back is EQUIVALENT rather than identical — a selector used by one
 * element becomes that element's own `css` and is renamed on the way back in, a binding's id is re-derived — and
 * every difference of that kind is one nothing else in the document can observe.
 *
 * Documents found in the wild are not all well formed, and some were written by a builder that has since moved on.
 * Rather than refusing them, what can be repaired is repaired and every repair is reported in `corrections`, so a
 * person can read what changed. Nothing is changed silently, and nothing that renders is dropped.
 */

export type SpecCorrectionCode =
  | 'legacy-element-type'
  | 'unknown-element-type'
  | 'dropped-field'
  | 'dropped-attribute'
  | 'fixed-attribute'
  | 'dropped-setting'
  | 'missing-element'
  | 'unreachable-element'
  | 'folded-state-selector'
  | 'dropped-selector'
  | 'unwritable-css'
  | 'folded-custom-css'
  | 'unknown-style-state'
  | 'broken-binding'
  | 'fixed-binding-source'
  | 'broken-flow'
  | 'fixed-global-callback'
  | 'dropped-initial-state'
  | 'missing-folder'
  | 'broken-layout';

export interface SpecCorrection {
  code: SpecCorrectionCode;
  message: string;
  /** The element, page or selector it concerns. */
  at?: string;
}

export interface SpecFromSpaceOptions {
  /** The space's name, when the document does not carry one. */
  name?: string;
  /** The space's permanent URL, when the document does not carry one. Ids and selector names derive from it. */
  permanentUrl?: string;
  /** Element types a plugin provides. Kept as they are, where any other type the SDK does not ship is reported. */
  pluginTypes?: readonly string[];
  /**
   * Keep every element's id, the positional ones nothing refers to included.
   *
   * Left out, an id like `container-19` that nothing names is dropped and derived again, which is right for a copy.
   * For a space people keep working in it is not: the builder's tree shows the id as the element's name, and a test
   * or a person may know an element by it.
   */
  keepIds?: boolean;
}

export interface SpecFromSpace {
  spec: SpaceSpec;
  corrections: SpecCorrection[];
}

/**
 * Element types the builder no longer ships, and what each one is today.
 *
 * A `navbar` was a horizontal list of links; the element that renders a list is `list`, so a navbar becomes one —
 * laid out in a row, because that is what the old element did without being asked.
 */
const LEGACY_ELEMENT_TYPES: Record<
  string,
  { type: string; attributes: (legacy: Record<string, unknown>) => Record<string, unknown>; css?: CssProps }
> = {
  navbar: {
    type: 'list',
    attributes: legacy => ({ subType: legacy.subtype === 'ol' ? 'ol' : 'ul' }),
    css: {
      display: 'flex',
      'list-style-type': 'none',
      'padding-left': '0px',
      'margin-top': '0px',
      'margin-bottom': '0px'
    }
  },
  navbarItem: { type: 'listItem', attributes: () => ({}) }
};

const DEFINITION_FIELDS = new Set([
  'label',
  'type',
  'rootId',
  'parentId',
  'items',
  'styleSelectors',
  'bindings',
  'interactions',
  'initialState',
  'runtime',
  'loadStrategy'
]);

const PAGE_ATTRIBUTES = new Set([
  'slug',
  'default',
  'name',
  'folder',
  'layout',
  'layoutContainer',
  'accessLevel',
  'unauthorizedBehaviour',
  'unauthorizedPageRedirect',
  'seoEnabled',
  'seoPageTitle',
  'seoPageDescription',
  'keepState',
  'stateStorage',
  'enabled'
]);

const LAYOUT_ATTRIBUTES = new Set(['folder', 'layout', 'layoutContainer']);

/**
 * Every setting a space can carry, which `schemaSettings.test.ts` holds to the `Schema['settings']` type.
 *
 * A key outside it is one nothing reads any more — `head`, from before a space declared its fonts.
 */
export const SCHEMA_SETTINGS = [
  'keepState',
  'stateStorage',
  'customCss',
  'userProvider',
  'tokenStorage',
  'loginUrl',
  'userUrl',
  'refreshUrl',
  'logoutUrl',
  'detailsPath',
  'tokenPath',
  'refreshTokenPath',
  'expirationTimePath',
  'refreshExpirationTimePath',
  'sessionHintCookie',
  'sessionExchangeUrl',
  'sessionGate',
  'sessionRevalidateSeconds',
  'debugMode'
] as const satisfies readonly (keyof Schema['settings'])[];

const SETTING_NAMES = new Set<string>(SCHEMA_SETTINGS);

/**
 * Values an older builder wrote for an attribute that the element's type spells differently today.
 *
 * A link's `target` is the window's name WITHOUT the underscore — the component adds it — so `_blank` rendered as
 * `__blank`: a named window, not a new one, which is the bug this repairs rather than preserves.
 */
const ATTRIBUTE_VALUE_FIXES: Record<string, Record<string, Record<string, string>>> = {
  link: { target: { _blank: 'blank', _self: 'self', _parent: 'parent', _top: 'top' } }
};

/** The same table, read by any type name — a document's types are strings, not the literal keys it is built from. */
const ATTRIBUTE_NAMES: Readonly<Record<string, readonly string[] | null>> = elementAttributeNames;

const BINDING_CATEGORIES: readonly BindingCategory[] = ['attributes', 'initialState', 'style'];

const isEmpty = (value: object | null | undefined): boolean => !value || Object.keys(value).length === 0;

const isBinding = (value: unknown): value is ElementBinding =>
  isRecord(value) && typeof value.source === 'string' && typeof value.to === 'string';

/** A condition worth keeping: the builder stores "no condition" as an empty group, or as an empty array. */
const conditionOf = <T>(when: T | undefined): T | undefined =>
  isRecord(when) && Array.isArray(when.rules) && when.rules.length > 0 ? when : undefined;

/**
 * Every name a document mentions outside its own structure — in attributes, bindings, steps and settings.
 *
 * What decides whether an id can be dropped (and derived again) or has to be written down: a name something else
 * refers to has to survive, and a name nothing refers to is bookkeeping. Tokenised once rather than searched per
 * id, and a token that joins a source prefix to an id (`apiContainer_posts`) also yields the id.
 */
const tokensOf = (corpus: string): Set<string> => {
  const tokens = new Set<string>();
  for (const token of corpus.split(/[^A-Za-z0-9_-]+/)) {
    if (!token) {
      continue;
    }

    tokens.add(token);
    for (let index = token.indexOf('_'); index !== -1; index = token.indexOf('_', index + 1)) {
      tokens.add(token.slice(index + 1));
    }
  }

  return tokens;
};

const stepCorpus = (host: string, interactions: Record<string, ElementInteraction>): unknown[] =>
  Object.values(interactions).map(node => ({
    params: node.params,
    when: node.when,
    // A trigger names the element it sits on, which is not a reference to anything.
    ...(node.elementId && node.elementId !== host ? { elementId: node.elementId } : {})
  }));

const bindingsOf = (bindings: unknown, category: BindingCategory): ElementBinding[] => {
  const list: unknown = isRecord(bindings) ? bindings[category] : undefined;

  return Array.isArray(list) ? list.filter(isBinding) : [];
};

// A binding's own id says only where it sits in its list; it is not a reference to anything.
const bindingCorpus = (bindings: unknown): unknown[] =>
  BINDING_CATEGORIES.flatMap(category =>
    bindingsOf(bindings, category).map(({ source, to, transformers, when }) => ({ source, to, transformers, when }))
  );

class SpecReader {
  private readonly corrections: SpecCorrection[] = [];

  private readonly flat: Record<string, Element>;

  private readonly references: Set<string>;

  private readonly classBlocks = new Map<string, SelectorBlocks>();

  private readonly elementBlocks = new Map<string, Record<string, SelectorBlocks>>();

  private readonly selectorUses = new Map<string, number>();

  /** Selectors kept as classes under their own name, rather than written into the one element that uses them. */
  private readonly keptClasses = new Set<string>();

  private readonly keptCss: string[] = [];

  private readonly reachable = new Set<string>();

  private readonly pluginTypes: Set<string>;

  private readonly folderIds = new Set<string>();

  private readonly layoutIds = new Set<string>();

  private readonly droppedFields = new Map<string, number>();

  private readonly droppedAttributes = new Map<string, number>();

  constructor(
    private readonly documents: SpaceDocuments,
    private readonly options: SpecFromSpaceOptions
  ) {
    this.flat = documents.schema.flat;
    this.pluginTypes = new Set(options.pluginTypes ?? []);
    this.references = tokensOf(
      JSON.stringify([
        Object.values(this.flat).map(element => [
          element.attributes,
          bindingCorpus(element.definition.bindings),
          stepCorpus(element.id, element.definition.interactions ?? {})
        ]),
        documents.schema.settings,
        documents.schema.variables
      ])
    );
  }

  read(): SpecFromSpace {
    const { schema, style } = this.documents;
    const definition = definitionOf(schema);
    const name = definition.name || this.options.name;
    const permanentUrl = definition.permanentUrl || this.options.permanentUrl;
    if (!name || !permanentUrl) {
      throw new Error(
        'The document names no space (`schema.definition` is empty): pass `name` and `permanentUrl` so the ids it derives are stable.'
      );
    }

    this.indexStyle(style);
    // An older export may carry no stylesheet at all.
    const written: unknown = schema.settings.customCss;
    const ownCss = this.foldCustomCss(typeof written === 'string' ? written : '');
    const pageFolders = this.readFolders();
    const roots = this.collectRoots();
    this.countSelectorUses(roots);

    const elements = this.readElementDefaults(style.mode);
    const layouts = roots.layouts.map(layout => this.readLayout(layout));
    const pages = roots.pages.map((page, index) => this.readPage(page, index));
    this.reportDroppedFields();
    this.reportUnreachable();

    const classes = this.classesSpec(style.mode);
    // `customCss` is read above — what is left of it once the rules a class can hold have moved into their classes.
    const settings = this.readSettings(
      Object.fromEntries(Object.entries(schema.settings).filter(([key]) => key !== 'customCss'))
    );
    const customCss = [ownCss, ...this.keptCss].filter(Boolean).join('\n\n');

    const spec: SpaceSpec = {
      name,
      permanentUrl,
      mode: style.mode,
      theme: style.theme,
      ...(isEmpty(style.variables) ? {} : { variables: style.variables }),
      ...(style.fonts && style.fonts.length > 0 ? { fonts: style.fonts } : {}),
      ...(isEmpty(elements) ? {} : { elements }),
      ...(isEmpty(classes) ? {} : { classes }),
      ...(schema.variables.length > 0 ? { schemaVariables: this.readSchemaVariables(schema.variables) } : {}),
      ...(isEmpty(settings) ? {} : { settings }),
      ...(customCss ? { customCss } : {}),
      ...(schema.rsc ? { rsc: schema.rsc } : {}),
      ...(pageFolders.length > 0 ? { pageFolders } : {}),
      ...(layouts.length > 0 ? { layouts } : {}),
      pages
    };

    return { spec, corrections: this.corrections };
  }

  /**
   * The settings, without the empty strings the builder writes for one nobody chose — not a value any of them takes
   * — and without a key no setting answers to any more.
   */
  private readSettings(stored: Record<string, unknown>): Partial<Omit<Schema['settings'], 'customCss'>> {
    const kept = Object.entries(stored).filter(([key, value]) => {
      if (!SETTING_NAMES.has(key)) {
        this.correct('dropped-setting', `Dropped the setting "${key}": nothing reads it.`);

        return false;
      }

      return value !== '';
    });

    return Object.fromEntries(kept);
  }

  /** A variable's category is a label, and a document that has none says so with null where the type wants text. */
  private readSchemaVariables(variables: Schema['variables']): Schema['variables'] {
    return variables.map(variable => ({ ...variable, category: categoryOf(variable) }));
  }

  private correct(code: SpecCorrectionCode, message: string, at?: string): void {
    this.corrections.push({ code, message, ...(at === undefined ? {} : { at }) });
  }

  // ---------------------------------------------------------------- style

  private indexStyle(style: Style): void {
    for (const breakpoint of ['desktop', 'tablet', 'mobile'] as const) {
      for (const [key, item] of Object.entries(style.platform[breakpoint])) {
        if (item.type === 'element') {
          const type = item.componentType ?? item.name;
          const slots = this.elementBlocks.get(type) ?? {};
          for (const [slot, block] of Object.entries(item.attributes)) {
            (slots[slot] ??= {})[breakpoint] = block;
          }

          this.elementBlocks.set(type, slots);
          continue;
        }

        // A hover written as a class of its own (`card:hover`), which is how the builder once stored a state. It is
        // the same selector's state today, and folding it in is what makes it editable again.
        const kind: string = item.type;
        if (kind === 'state') {
          const [owner, state] = item.name.split(':');
          const blocks = this.classBlocks.get(owner) ?? {};
          const block: StyleBlock = blocks[breakpoint] ?? { default: {} };
          block.states = { ...block.states, [state]: { ...item.attributes.base.default } };
          blocks[breakpoint] = block;
          this.classBlocks.set(owner, blocks);
          this.correct('folded-state-selector', `"${item.name}" is now the ${state} state of "${owner}".`, item.name);
          continue;
        }

        if (item.type !== 'class') {
          this.correct(
            'dropped-selector',
            `The ${item.type} selector "${key}" is not something a space can author.`,
            key
          );
          continue;
        }

        const extraSlots = Object.keys(item.attributes).filter(slot => slot !== 'base');
        if (extraSlots.length > 0) {
          this.correct(
            'dropped-selector',
            `Class "${key}" carried ${extraSlots.join(', ')} parts, which a class does not have; only its base is kept.`,
            key
          );
        }

        const blocks = this.classBlocks.get(key) ?? {};
        const existing = blocks[breakpoint];
        blocks[breakpoint] = existing
          ? { ...item.attributes.base, states: { ...item.attributes.base.states, ...existing.states } }
          : item.attributes.base;
        this.classBlocks.set(key, blocks);
      }
    }
  }

  /**
   * Moves the `customCss` rules a class can hold into the class, and answers the stylesheet that is left.
   *
   * Merged over what the class already says, because that is the cascade it replaces: `customCss` comes after the
   * style's own rules, so where both set a property the custom one is what rendered. Expanded first, so a `padding`
   * written there wins over the longhands the class stores rather than losing to them.
   */
  private foldCustomCss(stylesheet: string): string {
    const { folded, remaining } = foldCustomCss(stylesheet, name => this.classBlocks.has(name));
    for (const { targets, rules } of folded) {
      const expanded = css(rules);
      for (const { className, state } of targets) {
        const blocks = this.classBlocks.get(className) ?? {};
        const block: StyleBlock = blocks.desktop ?? { default: {} };
        if (state) {
          block.states = { ...block.states, [state]: { ...block.states?.[state], ...expanded } };
        } else {
          block.default = { ...block.default, ...expanded };
        }

        blocks.desktop = block;
        this.classBlocks.set(className, blocks);
      }

      const selectors = targets.map(({ className, state }) => `.${className}${state ? `:${state}` : ''}`);
      this.correct(
        'folded-custom-css',
        `The customCss rule for ${selectors.map(selector => `"${selector}"`).join(', ')} is now part of its class.`,
        targets[0]?.className
      );
    }

    return remaining;
  }

  private countSelectorUses(roots: { pages: Element[]; layouts: Element[] }): void {
    const visit = (element: Element): void => {
      for (const selector of Object.values(element.definition.styleSelectors)) {
        for (const name of selector ? classesOf(selector) : []) {
          this.selectorUses.set(name, (this.selectorUses.get(name) ?? 0) + 1);
        }
      }

      this.childrenOf(element, false).forEach(visit);
    };

    [...roots.layouts, ...roots.pages].forEach(visit);
  }

  private readReporting(name: string, blocks: SelectorBlocks): ReadSelector {
    const read = readSelector(blocks);
    if (read.unknownStates.length > 0) {
      this.correct(
        'unknown-style-state',
        `"${name}" had rules for ${read.unknownStates.map(state => `"${state}"`).join(', ')}, which no browser state matches.`,
        name
      );
    }

    return read;
  }

  private keepUnwritable(
    selector: { name: string; type: 'class' | 'element'; slot?: string },
    unwritable: UnwritableRules,
    mode: Style['mode']
  ): void {
    if (isEmpty(unwritable)) {
      return;
    }

    const properties = new Set(
      Object.values(unwritable).flatMap((block: StyleBlock) => [
        ...Object.keys(block.default ?? {}),
        ...Object.values(block.states ?? {}).flatMap(rules => Object.keys(rules)),
        ...Object.values(block.variants ?? {}).flatMap(variant => Object.keys(variant.default ?? {}))
      ])
    );
    this.keptCss.push(unwritableCss(selector, unwritable, mode));
    this.correct(
      'unwritable-css',
      `"${selector.name}" set ${[...properties].join(', ')}, which the style editor cannot hold; kept in customCss under the same selector.`,
      selector.name
    );
  }

  /**
   * How an element's base selector is written: inline, as a class, or not at all.
   *
   * Inline — the element's own `css` — only when nothing else could notice the name changing: one element uses it,
   * nothing in the document spells it out (a `customCss` rule, a twig template), and it carries nothing the inline
   * form cannot (a variant, a rule the editor cannot hold). Everything else stays a class under its own name.
   */
  private baseStyle(
    selector: string | undefined,
    inline: 'css' | 'css-and-states'
  ): { class?: string | string[]; css?: CssSpec; states?: StatesSpec } {
    if (!selector) {
      return {};
    }

    const names = classesOf(selector);
    if (names.length > 1) {
      const kept = this.keepClassList(names);

      return kept ? { class: kept } : {};
    }

    // A selector with no entry holds no rules — authoring names one for every element, styled or not — so it
    // reads as nothing at all rather than as something missing.
    const blocks = this.classBlocks.get(selector);
    if (!blocks) {
      return {};
    }

    const read = readSelector(blocks);
    const canInline =
      (this.selectorUses.get(selector) ?? 0) === 1 &&
      !this.references.has(selector) &&
      !read.variants &&
      isEmpty(read.unwritable) &&
      (inline === 'css-and-states' || !read.states);

    if (!canInline) {
      this.keptClasses.add(selector);

      return { class: selector };
    }

    this.readReporting(selector, blocks);

    return { ...(read.css ? { css: read.css } : {}), ...(read.states ? { states: read.states } : {}) };
  }

  /**
   * The classes of a selector that names several, every one kept as a class.
   *
   * None of them can become rules of the element's own: an element has one base selector, and these are shared by
   * definition. One the style document does not declare holds no rules, so it is left out — and said, because a
   * name somebody wrote on an element is not a name that goes missing quietly.
   */
  private keepClassList(names: string[]): string | string[] | undefined {
    const kept = names.filter(name => {
      if (this.classBlocks.has(name)) {
        this.keptClasses.add(name);

        return true;
      }

      this.correct(
        'dropped-selector',
        `The class "${name}" in "${names.join(' ')}" is not declared by the style document, so it is left out.`,
        name
      );

      return false;
    });

    if (kept.length === 0) {
      return undefined;
    }

    return kept.length === 1 ? kept[0] : kept;
  }

  /** Every class the space keeps, in the order the style document lists them — including ones nothing names. */
  private classesSpec(mode: Style['mode']): Record<string, StyleSpec> {
    const out: Record<string, StyleSpec> = {};
    for (const [name, blocks] of this.classBlocks) {
      const inlined = (this.selectorUses.get(name) ?? 0) > 0 && !this.keptClasses.has(name);
      if (inlined) {
        continue;
      }

      const read = this.readReporting(name, blocks);
      this.keepUnwritable({ name, type: 'class' }, read.unwritable, mode);
      out[name] = read.spec ?? {};
    }

    return out;
  }

  private readElementDefaults(mode: Style['mode']): NonNullable<SpaceSpec['elements']> {
    const out: NonNullable<SpaceSpec['elements']> = {};
    for (const [type, slots] of this.elementBlocks) {
      // An element type dressed only in a slot has no base block at all.
      const read = this.readReporting(type, Object.hasOwn(slots, 'base') ? slots.base : {});
      this.keepUnwritable({ name: type, type: 'element' }, read.unwritable, mode);

      const others = Object.entries(slots).filter(([slot]) => slot !== 'base');
      const slotSpecs = others.flatMap(([slot, blocks]) => {
        const slotRead = this.readReporting(`${type} ${slot}`, blocks);
        this.keepUnwritable({ name: type, type: 'element', slot }, slotRead.unwritable, mode);

        return slotRead.spec ? [[slot, slotRead.spec] as const] : [];
      });

      out[type] = {
        ...(read.css ? { base: read.css } : {}),
        ...(read.states ? { states: read.states } : {}),
        ...(read.variants ? { variants: read.variants } : {}),
        ...(slotSpecs.length > 0 ? { slots: Object.fromEntries(slotSpecs) } : {})
      };
    }

    return out;
  }

  // ---------------------------------------------------------------- tree

  private collectRoots(): { pages: Element[]; layouts: Element[] } {
    const { schema } = this.documents;
    const pages = schema.pages.flatMap(id => {
      const page = this.flat[id] as Element | undefined;
      if (!page) {
        this.correct('missing-element', `The page list names "${id}", which the document does not hold.`, id);

        return [];
      }

      return [page];
    });

    const pageIds = new Set(schema.pages);
    const layouts = Object.values(this.flat).filter(
      element =>
        !pageIds.has(element.id) && !element.definition.parentId && element.definition.type === 'layoutContainer'
    );
    layouts.forEach(layout => this.layoutIds.add(layout.id));

    return { pages, layouts };
  }

  private childrenOf(element: Element, report = true): Element[] {
    return (element.definition.items ?? []).flatMap(id => {
      const child = this.flat[id] as Element | undefined;
      if (!child) {
        if (report) {
          this.correct(
            'missing-element',
            `"${element.id}" lists "${id}" as a child, which the document does not hold.`,
            element.id
          );
        }

        return [];
      }

      return [child];
    });
  }

  private readFolders(): PageFolderSpec[] {
    const folders = this.documents.schema.pageFolders;
    folders.forEach(folder => this.folderIds.add(folder.id));

    return folders.map(folder => ({
      id: folder.id,
      ...(folder.name && folder.name !== folder.id ? { name: folder.name } : {}),
      ...(folder.slug !== folder.id ? { slug: folder.slug } : {}),
      ...(folder.parentId && this.folderIds.has(folder.parentId) ? { parent: folder.parentId } : {})
    }));
  }

  private folderOf(value: unknown, owner: string): string | undefined {
    if (typeof value !== 'string' || !value) {
      return undefined;
    }

    if (!this.folderIds.has(value)) {
      this.correct(
        'missing-folder',
        `${owner} was filed in folder "${value}", which the space does not declare.`,
        owner
      );

      return undefined;
    }

    return value;
  }

  private layoutRefOf(attributes: Record<string, unknown>, owner: string): LayoutRef | undefined {
    const { layout, layoutContainer } = attributes;
    if (typeof layout !== 'string' || !layout) {
      return undefined;
    }

    const slot = typeof layoutContainer === 'string' ? (this.flat[layoutContainer] as Element | undefined) : undefined;
    if (!this.layoutIds.has(layout) || !slot || slot.definition.rootId !== layout) {
      this.correct(
        'broken-layout',
        `${owner} named the layout "${layout}" with slot "${String(layoutContainer)}", which is not an element of that layout; the page renders without it.`,
        owner
      );

      return undefined;
    }

    return { id: layout, slot: slot.id };
  }

  private readLayout(layout: Element): LayoutSpec {
    this.reachable.add(layout.id);
    const where = `Layout "${layout.id}"`;
    const attributes = Object.fromEntries(
      Object.entries(layout.attributes).filter(
        ([key, value]) => !LAYOUT_ATTRIBUTES.has(key) && !(key === 'subType' && value === 'div')
      )
    );
    const folder = this.folderOf(layout.attributes.folder, where);
    const shell = this.layoutRefOf(layout.attributes, where);
    const bind = this.readBindings(layout);

    return {
      id: layout.id,
      ...(layout.definition.label && layout.definition.label !== 'Layout Container'
        ? { label: layout.definition.label }
        : {}),
      ...(folder ? { folder } : {}),
      ...(shell ? { layout: shell } : {}),
      ...(isEmpty(attributes) ? {} : { attributes }),
      ...this.baseStyle(layout.definition.styleSelectors.base, 'css-and-states'),
      ...(bind.bind ? { bind: bind.bind } : {}),
      ...this.readFlows(layout),
      body: this.childrenOf(layout).map(child => this.readElement(child))
    };
  }

  private readPage(page: Element, index: number): PageSpec {
    this.reachable.add(page.id);
    const attributes: Record<string, unknown> = isRecord(page.attributes) ? page.attributes : {};
    const where = `Page "${page.id}"`;
    for (const key of Object.keys(attributes)) {
      if (!PAGE_ATTRIBUTES.has(key)) {
        this.dropField(`page attribute "${key}"`);
      }
    }

    if (attributes.enabled === false) {
      this.correct(
        'dropped-field',
        `${where} was disabled, which an authored page cannot say; it is authored enabled.`,
        page.id
      );
    }

    const isDefault = attributes.default === true;
    const folder = this.folderOf(attributes.folder, where);
    const layout = this.layoutRefOf(attributes, where);
    const accessLevel =
      attributes.accessLevel === 'public' || attributes.accessLevel === 'authenticated'
        ? attributes.accessLevel
        : undefined;
    const redirect =
      attributes.unauthorizedBehaviour === 'redirect' && typeof attributes.unauthorizedPageRedirect === 'string'
        ? attributes.unauthorizedPageRedirect
        : undefined;
    const stateStorage =
      attributes.stateStorage === 'localStorage' || attributes.stateStorage === 'sessionStorage'
        ? attributes.stateStorage
        : undefined;
    const seoTitle = typeof attributes.seoPageTitle === 'string' ? attributes.seoPageTitle : '';
    const seoDescription = typeof attributes.seoPageDescription === 'string' ? attributes.seoPageDescription : '';

    if (BINDING_CATEGORIES.some(category => bindingsOf(page.definition.bindings, category).length > 0)) {
      this.correct('dropped-field', `${where} had bindings of its own, which a page cannot declare.`, page.id);
    }

    return {
      id: page.id,
      name: typeof attributes.name === 'string' ? attributes.name : page.id,
      slug: typeof attributes.slug === 'string' ? attributes.slug : '',
      ...(isDefault ? { isDefault: true } : index === 0 ? { isDefault: false } : {}),
      ...(seoTitle ? { seoTitle } : {}),
      ...(seoDescription ? { seoDescription } : {}),
      ...(folder ? { folder } : {}),
      ...(layout ? { layout } : {}),
      ...(accessLevel ? { accessLevel } : {}),
      ...(redirect ? { unauthorizedRedirect: redirect } : {}),
      ...(typeof attributes.keepState === 'boolean' ? { keepState: attributes.keepState } : {}),
      ...(stateStorage ? { stateStorage } : {}),
      ...this.pageStyle(page.definition.styleSelectors.base),
      ...this.readFlows(page),
      body: this.childrenOf(page).map(child => this.readElement(child))
    };
  }

  private pageStyle(selector: string | undefined): { class?: string | string[]; css?: CssSpec } {
    const style = this.baseStyle(selector, 'css');

    return { ...(style.class ? { class: style.class } : {}), ...(style.css ? { css: style.css } : {}) };
  }

  private dropField(field: string): void {
    this.droppedFields.set(field, (this.droppedFields.get(field) ?? 0) + 1);
  }

  private reportDroppedFields(): void {
    for (const [field, count] of this.droppedFields) {
      this.correct('dropped-field', `Dropped ${field} on ${count} element${count === 1 ? '' : 's'}: nothing reads it.`);
    }

    for (const [attribute, count] of this.droppedAttributes) {
      this.correct(
        'dropped-attribute',
        `Dropped the attribute ${attribute} on ${count} element${count === 1 ? '' : 's'}: the element does not read it.`
      );
    }
  }

  private reportUnreachable(): void {
    const unreachable = Object.keys(this.flat).filter(id => !this.reachable.has(id));
    if (unreachable.length > 0) {
      this.correct(
        'unreachable-element',
        `Dropped ${unreachable.length} element${unreachable.length === 1 ? '' : 's'} no page or layout contains: ${unreachable.join(', ')}.`
      );
    }
  }

  private typeOf(element: Element): { type: string; legacy?: (typeof LEGACY_ELEMENT_TYPES)[string] } {
    const original = element.definition.type;
    const legacy = LEGACY_ELEMENT_TYPES[original] as (typeof LEGACY_ELEMENT_TYPES)[string] | undefined;
    if (legacy) {
      this.correct(
        'legacy-element-type',
        `"${element.id}" was a ${original}, which is a ${legacy.type} today.`,
        element.id
      );

      return { type: legacy.type, legacy };
    }

    if (!Object.hasOwn(ATTRIBUTE_NAMES, original) && !this.pluginTypes.has(original)) {
      this.correct(
        'unknown-element-type',
        `"${element.id}" is a ${original}, which neither the SDK nor a declared plugin provides; kept as it is.`,
        element.id
      );
    }

    return { type: original };
  }

  private readElement(element: Element): ElementSpec {
    this.reachable.add(element.id);
    const definition = element.definition;
    for (const key of Object.keys(definition)) {
      if (!DEFINITION_FIELDS.has(key)) {
        this.dropField(`"${key}"`);
      }
    }

    const { type, legacy } = this.typeOf(element);
    // Some documents store an element with no attributes as an empty ARRAY, which reads as an object with none.
    const stored = isRecord(element.attributes) ? element.attributes : {};
    const attributes = this.readAttributes(type, legacy ? legacy.attributes(stored) : stored);
    const keepId =
      this.options.keepIds === true ||
      !new RegExp(`^${definition.type}-\\d+$`).test(element.id) ||
      this.references.has(element.id);

    const { base: baseSelector, ...slotSelectors } = definition.styleSelectors;
    const baseStyle = this.baseStyle(baseSelector, 'css-and-states');
    const style = legacy?.css && !baseStyle.class && !baseStyle.css ? { ...baseStyle, css: legacy.css } : baseStyle;
    const slots = Object.fromEntries(
      Object.entries(slotSelectors).flatMap(([slot, selector]) => {
        const names = selector ? classesOf(selector) : [];
        if (names.length > 1) {
          const kept = this.keepClassList(names);

          return kept ? [[slot, kept]] : [];
        }

        // A lone selector with no entry holds no rules — the same answer `baseStyle` gives.
        if (!selector || !this.classBlocks.has(selector)) {
          return [];
        }

        this.keptClasses.add(selector);

        return [[slot, selector]];
      })
    );

    const { bind, visible } = this.readBindings(element);
    const variant = this.readInitialState(element, type);

    return {
      type,
      ...(keepId ? { id: element.id } : {}),
      attributes,
      ...style,
      ...(variant ? { variant } : {}),
      ...(isEmpty(slots) ? {} : { slots }),
      ...(bind ? { bind } : {}),
      ...(visible === undefined ? {} : { visible }),
      ...this.readFlows(element),
      ...(definition.runtime ? { runtime: definition.runtime } : {}),
      ...(definition.loadStrategy ? { loadStrategy: definition.loadStrategy } : {}),
      meta: { label: definition.label },
      ...this.childrenSpec(element)
    };
  }

  /**
   * The attributes the element's component reads, and none of the rest.
   *
   * What a type does not declare is what an older builder left behind — a field that was renamed (`loading`, now
   * `loadMode`) or a control nobody renders any more — and nothing reads it. A type the SDK does not ship keeps all
   * of its attributes, since nothing here knows what its component reads.
   */
  private readAttributes(type: string, attributes: Record<string, unknown>): Record<string, unknown> {
    const names = Object.hasOwn(ATTRIBUTE_NAMES, type) ? ATTRIBUTE_NAMES[type] : undefined;
    if (!names) {
      return attributes;
    }

    const defaults = defaultAttributes(type);
    const fixes = Object.hasOwn(ATTRIBUTE_VALUE_FIXES, type) ? ATTRIBUTE_VALUE_FIXES[type] : undefined;
    const kept: [string, unknown][] = [];
    for (const [name, value] of Object.entries(attributes)) {
      if (!names.includes(name)) {
        const key = `${type}.${name}`;
        this.droppedAttributes.set(key, (this.droppedAttributes.get(key) ?? 0) + 1);
        continue;
      }

      // "Not set", in the two spellings an older builder used: `null`, and an empty list where the element keeps
      // a record. Left out, the factory writes the element's own default, which is what the component falls back to.
      const emptyList = Array.isArray(value) && value.length === 0 && isRecord(defaults[name]);
      if (value === null || emptyList) {
        continue;
      }

      if (typeof value === 'string' && fixes && Object.hasOwn(fixes, name) && Object.hasOwn(fixes[name], value)) {
        const fixed = fixes[name][value];
        this.correct('fixed-attribute', `A ${type} ${name} of "${value}" is "${fixed}" today.`);
        kept.push([name, fixed]);
        continue;
      }

      kept.push([name, value]);
    }

    return Object.fromEntries(kept);
  }

  private childrenSpec(element: Element): { children?: ElementSpec[] } {
    // No list, an empty one and a leaf are one answer: authoring writes `items: []` on every element it inserts.
    const children = this.childrenOf(element);

    return children.length > 0 ? { children: children.map(child => this.readElement(child)) } : {};
  }

  private readInitialState(element: Element, type: string): string | undefined {
    const initialState = element.definition.initialState ?? {};
    for (const key of Object.keys(initialState)) {
      if (key !== 'visibility' && key !== 'styleVariant') {
        this.correct(
          'dropped-initial-state',
          `"${element.id}" started with ${key} set, which nothing authored can declare.`,
          element.id
        );
      }
    }

    const styleVariant = initialState.styleVariant;

    if (!styleVariant) {
      return undefined;
    }

    const own = styleVariant[element.definition.type] ?? styleVariant[type];
    const others = Object.keys(styleVariant).filter(key => key !== element.definition.type && key !== type);
    if (others.length > 0 || (own && Object.keys(own).some(selector => selector !== 'base'))) {
      this.correct(
        'dropped-initial-state',
        `"${element.id}" started in a style variant of ${[...others, 'its parts'].join(', ')}, which only an element's base can declare.`,
        element.id
      );
    }

    const base = own?.base;

    return typeof base === 'string' && base ? base : undefined;
  }

  // ---------------------------------------------------------------- bindings

  /**
   * A source, as an author writes it — or `undefined` when it names nothing that exists.
   *
   * A full source (`apiContainer_posts.data`) is shortened to the element's name, which is what an author writes and
   * what authoring resolves again. A prefix that does not match what the element publishes names a source nothing
   * registers, so it is corrected rather than kept.
   */
  private sourceOf(source: string, at: string): string | undefined {
    const [head, ...rest] = source.split('.');
    const field = rest.length > 0 ? `.${rest.join('.')}` : '';
    if (GLOBAL_SOURCES.includes(head)) {
      return source;
    }

    const byName = (id: string): string | undefined => {
      const element = this.flat[id] as Element | undefined;

      return element ? elementSourceTypes[element.definition.type] : undefined;
    };

    if (byName(head)) {
      return source;
    }

    for (let index = head.indexOf('_'); index !== -1; index = head.indexOf('_', index + 1)) {
      const prefix = head.slice(0, index);
      const id = head.slice(index + 1);
      const expected = byName(id);
      if (!expected) {
        continue;
      }

      if (prefix !== expected) {
        this.correct(
          'fixed-binding-source',
          `${at} read "${source}", but "${id}" publishes as "${expected}_${id}".`,
          at
        );
      }

      return `${id}${field}`;
    }

    return undefined;
  }

  private readBindings(element: Element): { bind?: BindingSpec[] | Record<string, string>; visible?: string | false } {
    const hidden = element.definition.initialState?.visibility === false;
    const specs: BindingSpec[] = [];
    let visible: string | false | undefined = hidden ? false : undefined;

    for (const category of BINDING_CATEGORIES) {
      for (const raw of bindingsOf(element.definition.bindings, category)) {
        const at = `"${element.id}"`;
        const source = this.sourceOf(raw.source, at);
        if (!source) {
          this.correct(
            'broken-binding',
            `${at} bound ${raw.to} to "${raw.source}", which nothing publishes; dropped.`,
            element.id
          );
          continue;
        }

        const transformers = (raw.transformers ?? []).filter(transformer => transformer.action);
        const when = conditionOf(raw.when);
        const spec: BindingSpec = {
          to: raw.to,
          source,
          ...(category === 'attributes' ? {} : { category }),
          ...(transformers.length > 0 ? { transformers } : {}),
          ...(when ? { when } : {}),
          ...(raw.enabled === false ? { enabled: false } : {})
        };

        // The one binding with a field of its own: a condition that starts the element hidden.
        const negated =
          transformers.length === 1 && transformers[0].action === 'not' && isEmpty(transformers[0].params);
        if (
          visible === false &&
          category === 'initialState' &&
          raw.to === 'visibility' &&
          !when &&
          raw.enabled !== false &&
          (transformers.length === 0 || negated)
        ) {
          visible = negated ? `!${source}` : source;
          continue;
        }

        specs.push(spec);
      }
    }

    if (specs.length === 0) {
      return { ...(visible === undefined ? {} : { visible }) };
    }

    const short = specs.every(spec => Object.keys(spec).length === 2);

    return {
      bind: short ? Object.fromEntries(specs.map(spec => [spec.to, spec.source])) : specs,
      ...(visible === undefined ? {} : { visible })
    };
  }

  // ---------------------------------------------------------------- flows

  private readFlows(element: Element): { flows?: StepSpec[][] } {
    const nodes = element.definition.interactions;
    if (!nodes || isEmpty(nodes)) {
      return {};
    }

    const reached = new Set<string>();
    const flows: ElementInteraction[][] = [];
    for (const node of Object.values(nodes)) {
      if (node.beforeNode && Object.hasOwn(nodes, node.beforeNode)) {
        continue;
      }

      const chain: ElementInteraction[] = [];
      for (let current: ElementInteraction | undefined = node; current && !reached.has(current.id);) {
        reached.add(current.id);
        chain.push(current);
        current = current.afterNode && Object.hasOwn(nodes, current.afterNode) ? nodes[current.afterNode] : undefined;
      }

      if (chain.some(step => !step.action)) {
        this.correct(
          'broken-flow',
          `"${element.id}" had a flow with a step that runs nothing (${chain[0].id}); dropped.`,
          element.id
        );
        continue;
      }

      flows.push(chain);
    }

    const lost = Object.keys(nodes).filter(id => !reached.has(id));
    if (lost.length > 0) {
      this.correct(
        'broken-flow',
        `"${element.id}" had steps no flow reaches (${lost.join(', ')}); dropped.`,
        element.id
      );
    }

    if (flows.length === 0) {
      return {};
    }

    const anonymous = flows.map(chain => chain.map(node => this.readStep(node, element.id)));
    const named = flows.map((chain, flow) => chain.map((node, index) => ({ id: node.id, ...anonymous[flow][index] })));

    // Ids are left out only when authoring would derive exactly the same ones — a later step may read an earlier one
    // by id (`{{ webHook-1.response }}`), so a flow either keeps every id it had or needs none of them written.
    const derived = Object.keys(authorFlows(anonymous, element.id));
    const original = flows.flat().map(node => node.id);

    return { flows: derived.join() === original.join() ? anonymous : named };
  }

  private readStep(node: ElementInteraction, host: string): Omit<StepSpec, 'id'> {
    let on: string | undefined;
    if (node.type === 'globalCallback') {
      const declared = BUILTIN_GLOBAL_CALLBACKS[node.action] as { source: string } | undefined;
      on = node.elementId ?? undefined;
      if (declared && node.elementId !== declared.source) {
        this.correct(
          'fixed-global-callback',
          `"${host}" ran ${node.action} on "${String(node.elementId)}", but it is registered on "${declared.source}".`,
          host
        );
        on = declared.source;
      }
    } else if (node.type === 'trigger' || node.type === 'callback') {
      on = node.elementId && node.elementId !== host ? node.elementId : undefined;
    }

    const when = conditionOf(node.when);

    return {
      type: node.type,
      action: node.action,
      ...(node.title && node.title !== node.action ? { title: node.title } : {}),
      ...(isEmpty(node.params) ? {} : { params: node.params }),
      ...(isEmpty(node.preview) ? {} : { preview: node.preview }),
      ...(on ? { on } : {}),
      ...(when ? { when } : {}),
      ...(!node.enabled ? { enabled: false } : {})
    };
  }
}

/**
 * Reads a space's documents back into a {@link SpaceSpec}, repairing what can be repaired and reporting each repair.
 *
 * Pass the result to `authorSpace` and the documents that come back are equivalent to the ones read — the same
 * tree, the same rules under the same selectors wherever anything names them, the same bindings and flows — which
 * `compareSpaces` can prove for any particular pair.
 */
export const specFromSpace = (documents: SpaceDocuments, options: SpecFromSpaceOptions = {}): SpecFromSpace =>
  new SpecReader(documents, options).read();
