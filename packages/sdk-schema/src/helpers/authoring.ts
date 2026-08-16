import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import FlatMap from './FlatMap';

import type {
  BindingCategory,
  DisplayMode,
  Element,
  ElementBinding,
  ElementInteraction,
  ElementRuntime,
  Schema,
  SchemaVariable,
  Style,
  StyleItem,
  StyleObject,
  StyleVariables
} from '@plitzi/sdk-shared';

/**
 * Authoring a space without the builder.
 *
 * A space is two documents of deeply cross-referenced ids: every element carries its own id, its parent's, its
 * root's and the name of a style selector that has to exist in three breakpoint maps, and an interaction is a
 * linked list threaded through `beforeNode`/`afterNode`. Writing that by hand is how you end up with 400 KB of
 * exported JSON that nobody can review or re-theme — so the parts a person actually decides (a tree, some CSS,
 * what happens on click) are declared here and every id, selector name and back-reference is derived.
 *
 * Ids are hashes of the path that produced them, not random: authoring the same space twice writes byte-identical
 * documents, so a seed can re-run without churning what it wrote last time.
 *
 * Insertion goes through `FlatMap`, so a tree built here is held to exactly the same validity and idRef rules as
 * one built by dragging elements around the builder.
 */

export type StyleRules = StyleObject;

/** Per-breakpoint CSS for one element. Omitted breakpoints inherit, as they do in the builder. */
export type ResponsiveStyle = Partial<Record<DisplayMode, StyleRules>>;

/** A step in an interaction flow. The chaining, ids and flow id are derived; this is what the author decides. */
export interface StepSpec {
  type: ElementInteraction['type'];
  action: string;
  title?: string;
  params?: Record<string, unknown>;
  preview?: Record<string, unknown>;
  /** The idRef the step is registered on. Utilities are resolved by action alone and take none. */
  on?: string;
  when?: ElementInteraction['when'];
  enabled?: boolean;
}

export interface BindingSpec {
  /** Attribute, style property or state key that receives the value. */
  to: string;
  /** Where the value comes from, as `<idRef>.<path>` — e.g. `apiContainer_products-1.data`. */
  source: string;
  category?: BindingCategory;
  transformers?: ElementBinding['transformers'];
  when?: ElementBinding['when'];
  enabled?: boolean;
}

export interface ElementSpec {
  type: string;
  label?: string;
  attributes?: Record<string, unknown>;
  /** Style variant of the element's own vocabulary, e.g. a heading's `title`. */
  variant?: string;
  style?: ResponsiveStyle;
  /**
   * Reuse a selector authored elsewhere in the space instead of minting one. Two elements naming the same class
   * share one rule, which is the difference between a stylesheet and a pile of one-off declarations.
   */
  className?: string;
  bindings?: BindingSpec[];
  /** One flow per entry. Steps are chained in order. */
  flows?: StepSpec[][];
  runtime?: ElementRuntime;
  children?: ElementSpec[];
}

export interface PageSpec {
  name: string;
  /** Route, without a leading slash. Empty is the home page. */
  slug: string;
  isDefault?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  accessLevel?: 'public' | 'authenticated';
  style?: ResponsiveStyle;
  flows?: StepSpec[][];
  body: ElementSpec[];
}

/** Per element *type* defaults — what `.plitzi__heading` resolves to before any class applies. */
export interface ElementStyleSpec {
  base?: StyleRules;
  variants?: Record<string, StyleRules>;
}

export interface SpaceSpec {
  name: string;
  permanentUrl: string;
  /** CSS custom properties, by category. `color` is the usual one. */
  variables?: Partial<StyleVariables>;
  /** Named classes an element can reach with `className`, so a rule is written once. */
  classes?: Record<string, ResponsiveStyle>;
  elements?: Record<string, ElementStyleSpec>;
  schemaVariables?: SchemaVariable[];
  customCss?: string;
  mode?: Style['mode'];
  theme?: Style['theme'];
  pages: PageSpec[];
}

export interface AuthoredSpace {
  schema: Schema;
  style: Style;
}

const BREAKPOINTS: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

/**
 * Deterministic hex digest, in plain TypeScript.
 *
 * FNV-1a over the string, re-run with a different offset basis per 8-hex block. Not `node:crypto`: this module is
 * exported from the package root, and the builder bundles that root for the browser — one `node:` import here is a
 * broken bundle there. Nothing security-bearing depends on it either; it exists so the same declaration yields the
 * same ids twice, and 96 bits of it is far past collision for the few hundred paths a space contains.
 */
const digest = (value: string, length: number): string => {
  let out = '';

  for (let block = 0; out.length < length; block += 1) {
    let acc = 0x811c9dc5 ^ (block * 0x01000193);

    for (let index = 0; index < value.length; index += 1) {
      acc ^= value.charCodeAt(index);
      acc = Math.imul(acc, 0x01000193);
    }

    out += (acc >>> 0).toString(16).padStart(8, '0');
  }

  return out.slice(0, length);
};

/** Mongo-shaped, so an authored document is indistinguishable from an exported one — but derived from the path. */
export const authoringId = (path: string): string => digest(`plitzi:authoring:${path}`, 24);

const declarationsToCss = (rules: StyleRules): string =>
  Object.entries(rules)
    .map(([property, value]) => `${property}:${String(value)};`)
    .join('');

const classCss = (selector: string, rules: StyleRules): string => `.${selector}{${declarationsToCss(rules)}}`;

const elementCss = (type: string, spec: ElementStyleSpec): string => {
  const variants = Object.entries(spec.variants ?? {})
    .map(([name, rules]) => `&[data-variant="${name}"],&.${type}--${name}{${declarationsToCss(rules)}}`)
    .join('');

  return `.plitzi__${type}{${declarationsToCss(spec.base ?? {})}${variants}}`;
};

/**
 * One interaction flow, chained.
 *
 * The nodes are a linked list — each knows the one before and the one after, and they all carry the id of the
 * first as their `flowId`. Getting one of those three wrong produces a flow that half runs, which is why this is
 * derived from the order the steps were written in rather than declared.
 */
export const authorFlow = (path: string, steps: StepSpec[]): Record<string, ElementInteraction> => {
  const ids = steps.map((_, index) => `node_${authoringId(`${path}/step/${index}`)}`);
  const flowId = ids[0] ?? '';

  return steps.reduce<Record<string, ElementInteraction>>((flow, step, index) => {
    flow[ids[index]] = {
      id: ids[index],
      title: step.title ?? step.action,
      type: step.type,
      action: step.action,
      params: step.params ?? {},
      preview: step.preview ?? {},
      elementId: step.on ?? null,
      beforeNode: index === 0 ? '' : ids[index - 1],
      afterNode: index === steps.length - 1 ? '' : ids[index + 1],
      flowId,
      enabled: step.enabled ?? true,
      ...(step.when ? { when: step.when } : {})
    };

    return flow;
  }, {});
};

/** One binding, with the fields the runtime requires but nobody chooses filled in. */
export const authorBinding = (path: string, index: number, spec: BindingSpec): ElementBinding => ({
  id: authoringId(`${path}/binding/${index}`),
  source: spec.source,
  to: spec.to,
  transformers: spec.transformers ?? [],
  ...(spec.when ? { when: spec.when } : {}),
  ...(spec.enabled === undefined ? {} : { enabled: spec.enabled })
});

const groupBindings = (path: string, specs: BindingSpec[]): Partial<Record<BindingCategory, ElementBinding[]>> =>
  specs.reduce<Partial<Record<BindingCategory, ElementBinding[]>>>((groups, spec, index) => {
    const category = spec.category ?? 'attributes';
    groups[category] = [...(groups[category] ?? []), authorBinding(path, index, spec)];

    return groups;
  }, {});

class SpaceAuthor {
  private readonly flatMap = new FlatMap({ flat: {}, variables: [] });

  private readonly platform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };

  private readonly refCounters = new Map<string, number>();

  constructor(private readonly spec: SpaceSpec) {}

  author(): AuthoredSpace {
    for (const [type, elementSpec] of Object.entries(this.spec.elements ?? {})) {
      this.platform.desktop[type] = {
        name: type,
        type: 'element',
        componentType: type,
        attributes: {
          base: {
            default: elementSpec.base ?? {},
            ...(elementSpec.variants
              ? {
                  variants: Object.fromEntries(
                    Object.entries(elementSpec.variants).map(([name, rules]) => [name, { default: rules }])
                  )
                }
              : {})
          }
        },
        cache: elementCss(type, elementSpec)
      };
    }

    for (const [name, responsive] of Object.entries(this.spec.classes ?? {})) {
      this.writeSelector(name, responsive);
    }

    const pages = this.spec.pages.map((page, index) => this.addPage(page, index));

    const style: Style = {
      ...EMPTY_STYLE_SCHEMA,
      mode: this.spec.mode ?? EMPTY_STYLE_SCHEMA.mode,
      theme: this.spec.theme ?? EMPTY_STYLE_SCHEMA.theme,
      platform: this.platform,
      variables: this.spec.variables ?? {},
      cache: ''
    };
    style.cache = generateCache(style);

    const schema: Schema = {
      definition: { name: this.spec.name, permanentUrl: this.spec.permanentUrl },
      flat: this.flatMap.flat,
      variables: this.spec.schemaVariables ?? [],
      settings: { customCss: this.spec.customCss ?? '' },
      pages,
      pageFolders: []
    };

    // The same gate the builder is held to. An authored space that cannot pass it is a bug in the declaration,
    // and finding out at seed time beats finding out at render time.
    this.flatMap.assertValid(`authored space "${this.spec.permanentUrl}"`);

    return { schema, style };
  }

  private nextRef(type: string): string {
    const next = (this.refCounters.get(type) ?? 0) + 1;
    this.refCounters.set(type, next);

    return `${type}-${next}`;
  }

  private writeSelector(name: string, responsive: ResponsiveStyle): void {
    for (const breakpoint of BREAKPOINTS) {
      const rules = responsive[breakpoint];
      if (!rules || Object.keys(rules).length === 0) {
        continue;
      }

      const item: StyleItem = {
        name,
        type: 'class',
        attributes: { base: { default: rules } },
        cache: classCss(name, rules)
      };

      this.platform[breakpoint][name] = item;
    }
  }

  /** A shared class when one was named, otherwise a selector of this element's own, named after where it sits. */
  private selectorFor(path: string, spec: { type: string; className?: string; style?: ResponsiveStyle }): string {
    if (spec.className) {
      return spec.className;
    }

    const selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}`, 4)}`;
    this.writeSelector(selector, spec.style ?? {});

    return selector;
  }

  private addPage(page: PageSpec, index: number): string {
    const path = `${this.spec.permanentUrl}/${page.slug || 'home'}`;
    const id = authoringId(path);

    const element: Element = {
      id,
      idRef: this.nextRef('page'),
      attributes: {
        slug: page.slug,
        default: page.isDefault ?? index === 0,
        name: page.name,
        accessLevel: page.accessLevel ?? 'public',
        seoEnabled: Boolean(page.seoTitle ?? page.seoDescription),
        ...(page.seoTitle ? { seoPageTitle: page.seoTitle } : {}),
        ...(page.seoDescription ? { seoPageDescription: page.seoDescription } : {})
      },
      definition: {
        label: 'Page',
        type: 'page',
        rootId: id,
        items: [],
        styleSelectors: { base: this.selectorFor(path, { type: 'page', style: page.style }) },
        ...(page.flows ? { interactions: this.authorFlows(path, page.flows) } : {})
      }
    };

    // `custom` is the one drop position that inserts without a parent, which is what a page is.
    this.flatMap.addElement(element, '', 'custom');

    page.body.forEach((child, childIndex) => this.addElement(child, `${path}/${childIndex}`, id, id));

    return id;
  }

  private authorFlows(path: string, flows: StepSpec[][]): Record<string, ElementInteraction> {
    return flows.reduce<Record<string, ElementInteraction>>(
      (all, steps, index) => ({ ...all, ...authorFlow(`${path}/flow/${index}`, steps) }),
      {}
    );
  }

  private addElement(spec: ElementSpec, path: string, rootId: string, parentId: string): string {
    const id = authoringId(path);

    const element: Element = {
      id,
      idRef: this.nextRef(spec.type),
      attributes: spec.attributes ?? {},
      definition: {
        label: spec.label ?? spec.type,
        type: spec.type,
        rootId,
        parentId,
        items: [],
        styleSelectors: { base: this.selectorFor(path, spec) },
        initialState: {
          visibility: true,
          ...(spec.variant ? { styleVariant: { [spec.type]: { base: spec.variant } } } : {})
        },
        ...(spec.runtime ? { runtime: spec.runtime } : {}),
        ...(spec.bindings ? { bindings: groupBindings(path, spec.bindings) } : {}),
        ...(spec.flows ? { interactions: this.authorFlows(path, spec.flows) } : {})
      }
    };

    this.flatMap.addElement(element, parentId, 'inside');

    spec.children?.forEach((child, index) => this.addElement(child, `${path}/${index}`, rootId, id));

    return id;
  }
}

/** Build a space's two documents from a declaration. Throws if the result would not be a valid schema. */
export const authorSpace = (spec: SpaceSpec): AuthoredSpace => new SpaceAuthor(spec).author();

/**
 * Thin constructors for the element types every space uses.
 *
 * Deliberately unopinionated — they set `type` and the one attribute that type is about, and nothing else. Layout
 * and looks stay in the caller's `style`, because a factory that decided padding for you would be a design system
 * wearing a schema's clothes.
 */
export const container = (
  children: ElementSpec[],
  style?: ResponsiveStyle,
  rest: Partial<ElementSpec> = {}
): ElementSpec => ({
  type: 'container',
  label: 'Container',
  attributes: { subType: 'div', ...rest.attributes },
  children,
  ...(style ? { style } : {}),
  ...rest
});

export const heading = (content: string, subType: string, style?: ResponsiveStyle, variant?: string): ElementSpec => ({
  type: 'heading',
  label: 'Heading',
  attributes: { subType, content },
  ...(variant ? { variant } : {}),
  ...(style ? { style } : {})
});

export const paragraph = (content: string, style?: ResponsiveStyle): ElementSpec => ({
  type: 'paragraph',
  label: 'Paragraph',
  attributes: { content },
  ...(style ? { style } : {})
});

export const text = (content: string, style?: ResponsiveStyle): ElementSpec => ({
  type: 'text',
  label: 'Text',
  attributes: { content },
  ...(style ? { style } : {})
});

export const link = (href: string, children: ElementSpec[], style?: ResponsiveStyle): ElementSpec => ({
  type: 'link',
  label: 'Link',
  attributes: { href },
  children,
  ...(style ? { style } : {})
});

export const image = (src: string, alt: string, style?: ResponsiveStyle): ElementSpec => ({
  type: 'image',
  label: 'Image',
  attributes: { src, alt, srcLink: '', linkTarget: '_self' },
  ...(style ? { style } : {})
});

export const icon = (name: string, style?: ResponsiveStyle): ElementSpec => ({
  type: 'fontAwesome',
  label: 'Icon',
  attributes: { icon: name, size: 'fa-1x' },
  ...(style ? { style } : {})
});
