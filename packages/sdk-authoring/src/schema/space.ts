import { parentChain } from '@plitzi/sdk-schema/helpers/elementTree';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { rendersNoTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';
import { getSlugParams } from '@plitzi/sdk-shared/navigation';
import { parseSpaceFont } from '@plitzi/sdk-shared/style/fontValidation';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import processSelector from '@plitzi/sdk-style/helpers/processSelector';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { BREAKPOINTS, classNames, classRefs, isStyleDeclaration, sameBlocks, toBlocks } from '../style';
import { GLOBAL_SOURCES, groupBindings, hasVisibilityBinding, withVisibility } from './bindings';
import { authorFlows } from './flows';
import {
  ELEMENT_SPEC_KEYS,
  ELEMENT_STYLE_SPEC_KEYS,
  LAYOUT_SPEC_KEYS,
  PAGE_FOLDER_SPEC_KEYS,
  PAGE_SPEC_KEYS,
  SPACE_SPEC_KEYS,
  STEP_SPEC_KEYS,
  assertBindingShape,
  assertId,
  assertKnownKeys
} from './guard';
import { buildHandles, pathForSlug, selectorFor } from './handles';
import { digest } from './ids';
import { notificationsCss } from './notifications';
import { didYouMean } from './suggest';
import { assertSpaceValid } from './validate';

import type { SourceIndex } from './bindings';
import type { ElementHandle, LayoutHandle, PageHandle } from './handles';
import type {
  AuthorSpaceOptions,
  AuthoredSpace,
  ElementSpec,
  ElementStyleSpec,
  LayoutRef,
  LayoutSpec,
  PageFolderSpec,
  PageSpec,
  SpaceSpec,
  StepSpec
} from './types';
import type { ClassList, CssSpec, ResponsiveBlock, StatesSpec } from '../style';
import type { SchemaValidationError } from '@plitzi/sdk-schema/helpers/schemaValidator';
import type { DropPosition, Element, PageFolder, Schema, SpaceFont, Style, StyleItem } from '@plitzi/sdk-shared';

/**
 * Authoring a space without the builder.
 *
 * The parts a person actually decides — a tree, some CSS, what happens on click — are declared as specs, and every
 * selector name and back-reference is derived from them. An element's id is either the name the author gave it or
 * `<type>-<n>` counted per type, both deterministic — so authoring the same space twice writes byte-identical
 * documents and a seed can re-run without churning what it wrote last time.
 *
 * Insertion goes through `FlatMap`, so a tree built here is held to exactly the same validity and naming rules as
 * one built by dragging elements around the builder, and the finished pair is put through the document validator
 * and the linter before it is handed back — the same gate every space goes through, whoever wrote it. This module is
 * the only thing in the SDK that writes a schema document: every other authoring fragment produces specs, and specs
 * are inert until they reach here.
 */

/** A selector's cache, written by the same function the style editor writes it with — states and variants included. */
const withCache = (item: Omit<StyleItem, 'cache'>): StyleItem => {
  const complete: StyleItem = { ...item, cache: '' };
  complete.cache = processSelector(complete);

  return complete;
};

/** The two attributes a page or a layout names its shell with. */
const layoutAttributes = (layout: LayoutRef | undefined): Record<string, string> =>
  layout ? { layout: layout.id, layoutContainer: layout.slot } : {};

class SpaceAuthor {
  private readonly flatMap = new FlatMap({ flat: {}, variables: [] });

  private readonly platform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };

  private readonly idCounters = new Map<string, number>();

  /** Every name the AUTHOR wrote, collected before the tree is built so a derived `<type>-<n>` never lands on one. */
  private readonly authorNames = new Set<string>();

  private readonly pagePaths = new Set<string>();

  /** Where each id was written, so a second element answering to it can say where the first one is. */
  private readonly authoredAt = new Map<string, string>();

  /** Each folder's route prefix, resolved through its parents. Filled before any page is written. */
  private readonly folderPrefixes = new Map<string, string>();

  /**
   * What a test will address this space by, collected as the tree is written rather than walked again afterwards.
   *
   * Here and not in a second pass because this is the only place that knows an element's FINAL id: a spec may leave
   * it out, and the derived `<type>-<n>` exists nowhere until it is minted below.
   */
  private readonly handles: Record<string, PageHandle> = {};
  private readonly layoutHandles: Record<string, LayoutHandle> = {};

  /** Every class this space declares, whether from `classes` or from a `styles()` declaration found in the tree. */
  private readonly classRules = new Map<string, ResponsiveBlock>();
  /** Every element's own selector, named or derived — each one is that element's alone. */
  private readonly ownSelectors = new Set<string>();

  /** Every element in this space that publishes a data source, by id, and the name it publishes it under. */
  private readonly sources: SourceIndex = new Map();

  /** Rules that render, and render differently from what they plainly mean — see `warnTabletOnly`. */
  private readonly styleWarnings: SchemaValidationError[] = [];

  constructor(
    private readonly spec: SpaceSpec,
    private readonly options: AuthorSpaceOptions = {}
  ) {}

  author(): AuthoredSpace {
    this.assertSpaceShape();
    for (const [type, elementSpec] of Object.entries(this.spec.elements ?? {})) {
      this.writeElementDefaults(type, elementSpec);
    }

    for (const [name, value] of Object.entries(this.spec.classes ?? {})) {
      if (!isStyleDeclaration(value)) {
        this.declareClass(name, toBlocks(value), 'The space-wide `classes`');
        continue;
      }

      if (value.name !== name) {
        throw new Error(
          `The space-wide \`classes\` lists the declaration "${value.name}" under the name "${name}". A declaration is listed under its own name.`
        );
      }

      this.declareClass(name, value.rules, 'The space-wide `classes`');
    }

    const layouts = this.spec.layouts ?? [];

    // Before the tree is written, so the stylesheet is whole by the time anything names a class and a name that
    // means two different things is refused at the declaration rather than at whichever use happened to be second.
    layouts.forEach(layout => this.collectDeclarations(layout.class, layout.body, `Layout "${layout.id}"`));
    this.spec.pages.forEach(page => this.collectDeclarations(page.class, page.body, `Page "${page.name}"`));

    // Same reason, for the other thing an element names by a name declared elsewhere: a binding may read a
    // provider written further down the page than the element reading it. The author's own names are collected in
    // the same pass, so a derived `<type>-<n>` never claims a name written further down.
    layouts.forEach(layout => {
      this.authorNames.add(layout.id);
      layout.body.forEach(child => this.collectSources(child));
    });
    this.spec.pages.forEach(page => {
      if (page.id) {
        this.authorNames.add(page.id);
      }

      page.body.forEach(child => this.collectSources(child));
    });

    for (const [name, responsive] of this.classRules) {
      // A class declared with no rules is still a class the space has — a hook for a stylesheet, a name its elements
      // wear — so it is written, empty. Left out, the document stops saying it exists, and reading it back drops the
      // name from every element wearing it.
      const blocks = BREAKPOINTS.some(breakpoint => responsive[breakpoint]) ? responsive : { desktop: {} };
      this.writeSelector(name, blocks, `Class "${name}"`);
    }

    this.assertAncestorClasses();

    this.assertComputedOnce();
    this.assertTransientState();
    const pageFolders = this.buildPageFolders();
    layouts.forEach(layout => this.addLayout(layout));
    const pages = this.spec.pages.map((page, index) => this.addPage(page, index));
    // After every root is written, because a slot is an element INSIDE a layout and a layout may be named by one
    // declared further down.
    layouts.forEach(layout => this.assertLayoutRef(layout.layout, `Layout "${layout.id}"`));
    this.spec.pages.forEach(page => this.assertLayoutRef(page.layout, `Page "${page.name}"`));
    if (pages.length === 0) {
      throw new Error(
        'The space has no pages. Write at least one: `pages: [{ id: "home", name: "Home", slug: "", body: [] }]`.'
      );
    }

    const style: Style = {
      ...EMPTY_STYLE_SCHEMA,
      mode: this.spec.mode ?? EMPTY_STYLE_SCHEMA.mode,
      theme: this.spec.theme ?? EMPTY_STYLE_SCHEMA.theme,
      platform: this.platform,
      variables: this.spec.variables ?? {},
      ...(this.spec.fonts ? { fonts: this.parseFonts(this.spec.fonts) } : {}),
      cache: ''
    };
    style.cache = generateCache(style);

    const schema: Schema = {
      definition: { name: this.spec.name, permanentUrl: this.spec.permanentUrl },
      flat: this.flatMap.flat,
      variables: this.spec.schemaVariables ?? [],
      settings: {
        ...this.spec.settings,
        customCss: [this.spec.customCss ?? '', notificationsCss(this.spec.notifications)].filter(Boolean).join('\n\n'),
        ...(this.spec.computed ? { computed: this.spec.computed } : {})
      },
      ...(this.spec.rsc ? { rsc: this.spec.rsc } : {}),
      pages,
      pageFolders
    };

    // The gate, and the same one anybody else's documents go through. An authored space that cannot pass it is a
    // bug in the declaration, and finding out at seed time beats finding out at render time.
    //
    // `FlatMap.assertValid` is deliberately not also called here: it validates the flat map with no pages
    // attached, which is a strictly weaker reading of the same document than the pair below.
    const warnings = assertSpaceValid({ schema, style }, `authored space "${this.spec.permanentUrl}"`, this.options);

    return {
      schema,
      style,
      handles: buildHandles(this.handles, this.layoutHandles),
      warnings: [...this.styleWarnings, ...warnings]
    };
  }

  /**
   * The flows' own shape, before they are written: a flow that has steps, and steps that are step specs. What the
   * steps MEAN — the module a callback runs on, the params it takes, the trigger that starts it — is read from the
   * written document by `lintSpace`, the gate every space goes through.
   */
  private assertFlowShapes(flows: StepSpec[][] | undefined, where: string): void {
    for (const steps of flows ?? []) {
      // An empty flow is written as nothing at all: the declaration would vanish from the document without a word.
      if (steps.length === 0) {
        throw new Error(
          `${where} has an empty flow. A flow is a list whose first step says WHEN it runs: \`[onClick(), setState({ … })]\`.`
        );
      }

      for (const step of steps) {
        assertKnownKeys(
          step,
          STEP_SPEC_KEYS,
          `${where}: a step`,
          ' Build steps with the step builders — `setState(…)`, `navigate(…)`.'
        );
      }
    }
  }

  /**
   * Whose vocabulary `variant` names: the element type's, unless a class the element wears declares that variant and
   * the type does not. The variant map is keyed by selector, and the class is the selector those rules live on — keyed
   * by the type, `avatar--violet` was never worn and the element rendered as if no variant had been asked for.
   */
  private variantOwner(spec: ElementSpec, variant: string): string {
    if (this.spec.elements?.[spec.type]?.variants?.[variant] !== undefined || spec.class === undefined) {
      return spec.type;
    }

    const owner = classNames(spec.class).find(name =>
      Object.values(this.classRules.get(name) ?? {}).some(block => block.variants?.[variant] !== undefined)
    );

    return owner ?? spec.type;
  }

  private writeElementDefaults(type: string, spec: ElementStyleSpec): void {
    const base = toBlocks({
      css: spec.base ?? {},
      states: spec.states,
      variants: spec.variants,
      ancestors: spec.ancestors
    });
    const slots = Object.entries(spec.slots ?? {}).map(([slot, rules]) => [slot, toBlocks(rules)] as const);

    for (const breakpoint of BREAKPOINTS) {
      const slotBlocks = slots.flatMap(([slot, blocks]) => {
        const block = blocks[breakpoint];

        return block ? [[slot, block] as const] : [];
      });

      // Desktop always, as the builder does: an element type the space dresses has an entry even when its base is
      // empty and only a slot says anything.
      if (breakpoint !== 'desktop' && !base[breakpoint] && slotBlocks.length === 0) {
        continue;
      }

      this.platform[breakpoint][type] = withCache({
        name: type,
        type: 'element',
        componentType: type,
        attributes: { base: base[breakpoint] ?? { default: {} }, ...Object.fromEntries(slotBlocks) }
      });
    }
  }

  /**
   * Adds a class to the space's stylesheet, or agrees it is already there.
   *
   * A `styles()` declaration is normally named in many places and often reached from more than one module, so
   * arriving twice is the ordinary case and not an error. Arriving twice saying DIFFERENT things is: a class name
   * that means one thing on one page and another somewhere else is a rule that silently depends on which file the
   * bundler reached first, which is the shape of bug this whole surface exists to make impossible.
   */
  private declareClass(name: string, blocks: ResponsiveBlock, where: string): void {
    const existing = this.classRules.get(name);
    if (!existing) {
      this.classRules.set(name, blocks);

      return;
    }

    if (!sameBlocks(existing, blocks)) {
      throw new Error(
        `${where} declares the class "${name}" with different rules to a declaration already made for that name. A class is one rule set per space: rename one of them, or make them agree.`
      );
    }
  }

  /**
   * Every `styles()` declaration the tree names, gathered before a line of it is written.
   *
   * A declaration is collected from where it is USED rather than from a list, which is the whole point of it — the
   * rules stay next to the element they dress — and it means one declared and never named writes nothing at all.
   */
  private collectDeclarations(rootClass: ClassList | undefined, body: ElementSpec[], rootWhere: string): void {
    const collect = (value: ClassList | undefined, where: string): void => {
      for (const ref of value ? classRefs(value) : []) {
        if (typeof ref !== 'string') {
          this.declareClass(ref.name, ref.rules, where);
        }
      }
    };

    const walk = (spec: ElementSpec): void => {
      collect(spec.class, `Element "${spec.type}"`);
      Object.entries(spec.slots ?? {}).forEach(([slot, value]) =>
        collect(value, `Slot "${slot}" of element "${spec.type}"`)
      );
      spec.children?.forEach(walk);
    };

    collect(rootClass, rootWhere);
    body.forEach(walk);
  }

  /**
   * Every element that publishes a data source, before anything binds to one — and every name the author wrote.
   *
   * Only elements NAMED by the author publish: a derived name is positional, so a binding naming one would move the
   * moment an element was added above it, which is why nothing is meant to refer to one. Naming the element is how
   * an author says "this is a thing other parts of the space point at".
   */
  private collectSources(spec: ElementSpec): void {
    if (spec.id) {
      this.authorNames.add(spec.id);
    }

    const sourceTypes = this.options.sourceTypes;
    const prefix = sourceTypes?.[spec.type];
    if (prefix && spec.id) {
      // The globals are registered for the whole space under bare names, so an element answering to one makes its
      // own source unreachable AND shadows the global for every binding in the space that meant the other one.
      if (GLOBAL_SOURCES.includes(spec.id)) {
        throw new Error(
          `Element "${spec.type}" is named "${spec.id}", which is one of the global data sources (${GLOBAL_SOURCES.join(', ')}). Give it another name.`
        );
      }

      this.sources.set(spec.id, prefix);
    }

    spec.children?.forEach(child => this.collectSources(child));
  }

  /**
   * A class an element names has to be one the space declared.
   *
   * The failure it removes is the quietest one in the whole surface: a mistyped class is a selector nothing
   * defines, so the element renders unstyled and every layer below considers that perfectly valid — the class
   * exists as a name, it simply has no rules.
   */
  private assertClass(name: string, where: string): void {
    if (this.classRules.has(name)) {
      return;
    }

    const classes = [...this.classRules.keys()];

    throw new Error(
      `${where} names the class "${name}", which this space does not declare${didYouMean(name, classes) || '.'} Declare it in \`classes\`, hand it a \`styles()\` declaration, or write the rules inline with \`css\`.`
    );
  }

  /** An ancestor condition names a class some ancestor wears; one this space does not declare can never match. */
  private assertAncestorClasses(): void {
    for (const breakpoint of BREAKPOINTS) {
      for (const item of Object.values(this.platform[breakpoint])) {
        for (const [slot, block] of Object.entries(item.attributes)) {
          for (const ancestor of Object.keys(block.ancestors ?? {})) {
            this.assertClass(
              ancestor,
              `The ${item.type} "${item.name}" (${slot}, ${breakpoint}), in its \`ancestors\`,`
            );
          }
        }
      }
    }
  }

  /** `<type>-<n>` for an element nobody named. Positional and deterministic, so a re-run writes the same document;
   *  it steps over anything the author named so a derived name can never take one. */
  private nextId(type: string): string {
    let next = (this.idCounters.get(type) ?? 0) + 1;
    while (this.authorNames.has(`${type}-${next}`)) {
      next += 1;
    }

    this.idCounters.set(type, next);

    return `${type}-${next}`;
  }

  /**
   * The fonts, through the parser every other way into a manifest uses.
   *
   * A face with no fallback, no weights or an unknown source is still a `<link>` the page server writes, and the
   * page then renders in whatever the browser picks — so it is refused here, by index and family, with the
   * parser's own reason.
   */
  private parseFonts(fonts: SpaceFont[]): SpaceFont[] {
    return fonts.map((font, index) => {
      try {
        return parseSpaceFont(font);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        throw new Error(`Font ${index} ("${font.family}") in space "${this.spec.permanentUrl}": ${reason}`, {
          cause: error
        });
      }
    });
  }

  /**
   * A tablet rule a phone never sees.
   *
   * The breakpoints are RANGES, not a cascade: `tablet` is 48–64rem, `mobile` is below 48rem, and each inherits
   * only from `desktop`. So a layout that collapses to a column at tablet and says nothing for mobile comes back as
   * desktop columns on a phone — the narrowest screen gets the widest layout, and every check passes. A warning and
   * not a refusal, because a rule meant for tablets alone is legal, just rarely what anybody meant.
   */
  private warnTabletOnly(blocks: ResponsiveBlock, where: string): void {
    const tablet = blocks.tablet?.default ?? {};
    const mobile = blocks.mobile?.default ?? {};
    const skipped = Object.keys(tablet).filter(property => !Object.hasOwn(mobile, property));
    if (skipped.length === 0) {
      return;
    }

    this.styleWarnings.push({
      code: 'tablet-rule-skips-mobile',
      message: `${where} sets ${skipped.join(', ')} for tablet but not for mobile. Tablet (48–64rem) and mobile (below 48rem) are separate ranges and mobile inherits desktop, not tablet — so phones get the desktop value back. Repeat the rule under \`mobile\` if phones should keep it.`,
      details: { properties: skipped }
    });
  }

  private writeSelector(name: string, blocks: ResponsiveBlock, where: string): void {
    this.warnTabletOnly(blocks, where);

    for (const breakpoint of BREAKPOINTS) {
      const block = blocks[breakpoint];
      if (!block) {
        continue;
      }

      this.platform[breakpoint][name] = withCache({ name, type: 'class', attributes: { base: block } });
    }
  }

  /**
   * A name given to an element's own selector has to be one nothing else answers to: a declared class would have its
   * rules overwritten, and a second element naming it would share rules it never asked for.
   */
  private assertOwnSelector(name: string, where: string): void {
    if (!/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name)) {
      throw new Error(`${where} names its selector "${name}", which is not a CSS class name.`);
    }

    if (this.classRules.has(name) || this.ownSelectors.has(name)) {
      throw new Error(
        `${where} names its selector "${name}", which ${this.classRules.has(name) ? 'is a class this space declares' : 'another element already names'}. Use \`class\` to share rules; a selector of an element's own is its alone.`
      );
    }

    this.ownSelectors.add(name);
  }

  /**
   * A shared class when one was named, otherwise a selector of this element's own, named after where it sits.
   *
   * The two are exclusive because an element has exactly one base selector: asking for a shared rule AND a rule of
   * its own is a question with no answer, and the old behaviour — keep the class, drop the rules — is the kind of
   * silence this whole surface exists to remove.
   */
  private selectorFor(
    path: string,
    spec: { type: string; class?: ClassList; css?: CssSpec; states?: StatesSpec; selector?: string }
  ): string {
    if (spec.class && spec.selector) {
      throw new Error(
        `Element "${spec.type}" at ${path} names its own selector ("${spec.selector}") and wears a shared class. A shared class IS its selector: drop one of the two.`
      );
    }

    if (spec.class) {
      const names = classNames(spec.class);
      names.forEach(name => this.assertClass(name, `Element "${spec.type}" at ${path}`));

      if (spec.css || spec.states) {
        throw new Error(
          `Element "${spec.type}" at ${path} declares both a shared class ("${names.join(' ')}") and ${spec.css ? 'css' : 'states'} of its own. An element has one base selector: either write the rules into the class, or drop the class and keep the rules.`
        );
      }

      return names.join(' ');
    }

    // A class may carry any name — one read back from a builder document is `container-555c` — so the name derived
    // for an element's own rules steps past a class that already answers to it rather than overwriting its rules.
    if (spec.selector !== undefined) {
      this.assertOwnSelector(spec.selector, `Element "${spec.type}" at ${path}`);
      this.writeSelector(
        spec.selector,
        toBlocks({ css: spec.css, states: spec.states }),
        `Element "${spec.type}" at ${path}`
      );

      return spec.selector;
    }

    let selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}`, 4)}`;
    for (let attempt = 1; this.classRules.has(selector) || this.ownSelectors.has(selector); attempt += 1) {
      selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}#${attempt}`, 4)}`;
    }

    this.ownSelectors.add(selector);

    this.writeSelector(selector, toBlocks({ css: spec.css, states: spec.states }), `Element "${spec.type}" at ${path}`);

    return selector;
  }

  /**
   * Inserts through `FlatMap`, and refuses to carry on when it declines.
   *
   * It answers `false` rather than throwing — a builder dropping an element somewhere it may not go is not an
   * exception — so an ignored return here is an element that never made it into the document while the page it
   * belonged to authors perfectly well. The reason it is nearly always declined is a name two elements share,
   * and a name written twice is worth hearing about at the line that wrote it.
   */
  private insert(element: Element, to: string, position: DropPosition, path = to): void {
    const earlier = this.authoredAt.get(element.id);
    if (earlier !== undefined) {
      throw new Error(
        `Element "${element.id}" (${element.definition.type}) at ${path} uses a name already taken at ${earlier}. Ids are one namespace for the whole space — layouts and every page share it — so an element built by a function called more than once needs its id prefixed by what it is for (\`\${pageId}-foot\`).`
      );
    }

    if (!this.flatMap.addElement(element, to, position)) {
      throw new Error(
        `Could not author element "${element.id}" (${element.definition.type}) at ${path}: the schema refused it`
      );
    }

    this.authoredAt.set(element.id, path);
  }

  /**
   * The declaration's own shape, before anything is written from it: every field one the spec takes, every page and
   * layout and folder likewise, every value that comes from a list inside it.
   */
  private assertSpaceShape(): void {
    assertKnownKeys(this.spec, SPACE_SPEC_KEYS, 'The space');
    if (!Array.isArray(this.spec.pages)) {
      throw new Error(
        'The space has no `pages` list. Write at least one: `pages: [{ id: "home", name: "Home", slug: "", body: [] }]`.'
      );
    }

    for (const [type, style] of Object.entries(this.spec.elements ?? {})) {
      assertKnownKeys(style, ELEMENT_STYLE_SPEC_KEYS, `\`elements.${type}\``);
    }

    for (const folder of this.spec.pageFolders ?? []) {
      assertKnownKeys(folder, PAGE_FOLDER_SPEC_KEYS, `Page folder "${folder.id}"`);
    }

    for (const layout of this.spec.layouts ?? []) {
      assertKnownKeys(layout, LAYOUT_SPEC_KEYS, `Layout "${layout.id}"`);
      assertId(layout.id, `Layout "${layout.id}"`);
    }

    for (const page of this.spec.pages) {
      const where = `Page "${page.name}"`;
      assertKnownKeys(
        page,
        PAGE_SPEC_KEYS,
        where,
        ' Keeping state across visits is a setting of the whole space: `settings: { keepState: true }`, with `transientState` for the keys to leave out.'
      );
      assertId(page.id, where);
      if (typeof page.slug !== 'string') {
        throw new Error(
          `${where} has no \`slug\`. The home page's is '' and every other page's is its path: 'about', 'blog/{{slug}}'.`
        );
      }
    }
  }

  /** An element spec's own fields, before any of them is used. */
  private assertElementShape(spec: ElementSpec, path: string): void {
    const where = `The element at ${path}${typeof spec.id === 'string' ? ` ("${spec.id}")` : ''}`;
    assertKnownKeys(
      spec,
      ELEMENT_SPEC_KEYS,
      where,
      ' An attribute goes inside `attributes` — a factory puts it there for you: `button({ content: "Go" })`.'
    );
    if (typeof spec.type !== 'string' || spec.type === '') {
      throw new Error(`${where} has no \`type\`. Build elements with their factories — \`text(…)\`, \`container(…)\`.`);
    }

    // Read as `unknown`: the type says it is an object, and this is the check for the declarations the type never saw.
    const attributes: unknown = spec.attributes;
    if (
      attributes !== undefined &&
      (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes))
    ) {
      throw new Error(`${where}: \`attributes\` is not an object of attribute names and values.`);
    }

    if (spec.children !== undefined && !Array.isArray(spec.children)) {
      throw new Error(`${where}: \`children\` is not a list of elements.`);
    }

    assertId(spec.id, where);
  }

  /**
   * The space's computed values are written once, under `computed` — the same map in `settings` as well would leave
   * two answers to one question. What they say is `lintSpace`'s to read.
   */
  private assertComputedOnce(): void {
    if (this.spec.settings?.computed !== undefined) {
      throw new Error(
        '`settings.computed` is written through `computed` at the top of the space, not inside `settings`.'
      );
    }
  }

  /**
   * The keys a space never keeps: a list of `runtime.state` keys, as `setState` writes them.
   *
   * Refused when it could not work — not a list, an empty name, or a dotted one: the runtime compares top-level keys, so
   * `demo.step` would never match anything and the state would be kept exactly as if nothing had been said. Warned
   * when it cannot DO anything: without `keepState` nothing is kept in the first place.
   */
  private assertTransientState(): void {
    const transient: unknown = this.spec.settings?.transientState;
    if (transient === undefined) {
      return;
    }

    if (!Array.isArray(transient)) {
      throw new Error(
        `\`settings.transientState\` is ${JSON.stringify(transient)}. Write the state keys never to keep as a list: \`transientState: ['demoStep', 'panelOpen']\`.`
      );
    }

    for (const key of transient) {
      if (typeof key !== 'string' || key.trim() === '') {
        throw new Error(
          `\`settings.transientState\` has ${JSON.stringify(key)}, which is not a state key. Each entry is the \`key\` a \`setState\` step writes, like 'demoStep'.`
        );
      }

      if (key.includes('.')) {
        throw new Error(
          `\`settings.transientState\` has "${key}", a dotted path. It names top-level keys of \`runtime.state\` — write "${key.split('.')[0]}" to leave out everything under it.`
        );
      }
    }

    if (this.spec.settings?.keepState !== true) {
      this.styleWarnings.push({
        code: 'transient-state-without-keep-state',
        message:
          '`settings.transientState` names keys never to keep, but `settings.keepState` is not on — nothing is kept in the first place, so it does nothing. Turn `keepState` on, or remove `transientState`.',
        details: { keys: transient }
      });
    }
  }

  /** The element about to be placed under `parentId`, and everything that one is nested in. */
  private ancestorsOf(parentId: string): Set<string> {
    return Object.hasOwn(this.flatMap.flat, parentId)
      ? new Set([parentId, ...parentChain(this.flatMap.flat, parentId)])
      : new Set();
  }

  /**
   * Where a page's ids are derived from — its slug, unless another page already claimed it.
   *
   * Two pages SHARING one slug is a supported shape and the only way to put a sign-in and the page behind it on
   * one path: they differ by `accessLevel`, and the router picks. Derived from the slug alone they also shared
   * every id in their subtrees, and the second page's elements were refused one by one. Only the later page is
   * disambiguated, so no space that has no duplicate moves an id.
   */
  /**
   * The folders, and the route prefix each one contributes.
   *
   * Resolved once, before any page is written, for the reason every other declaration is: a page names a folder by
   * id, and a name that answers to nothing has to be refused where it was written rather than becoming a page that
   * quietly answers at the wrong URL. Nesting is walked with a seen-set — a folder declared as its own ancestor is
   * a cycle, and the honest answer to it is a throw and not an infinite loop.
   */
  private buildPageFolders(): PageFolder[] {
    const declared = this.spec.pageFolders ?? [];
    const byId = new Map(declared.map(folder => [folder.id, folder]));

    for (const folder of declared) {
      if (folder.parent !== undefined && !byId.has(folder.parent)) {
        throw new Error(
          `Page folder "${folder.id}" sits in "${folder.parent}", which this space does not declare${didYouMean(folder.parent, [...byId.keys()])}`
        );
      }
    }

    for (const folder of declared) {
      const seen = new Set<string>([folder.id]);
      let parent = folder.parent;
      while (parent !== undefined) {
        if (seen.has(parent)) {
          throw new Error(`Page folder "${folder.id}" is inside itself, through "${parent}"`);
        }

        seen.add(parent);
        parent = byId.get(parent)?.parent;
      }
    }

    for (const folder of declared) {
      const segments: string[] = [];
      let current: PageFolderSpec | undefined = folder;
      while (current) {
        segments.unshift(current.slug ?? current.id);
        current = current.parent === undefined ? undefined : byId.get(current.parent);
      }

      this.folderPrefixes.set(folder.id, segments.filter(Boolean).join('/'));
    }

    return declared.map(folder => ({
      id: folder.id,
      name: folder.name ?? folder.id,
      slug: folder.slug ?? folder.id,
      ...(folder.parent === undefined ? {} : { parentId: folder.parent })
    }));
  }

  /** Where a page ANSWERS: its folder's chain of slugs, then its own. What a test navigates to. */
  private routeFor(page: PageSpec): string {
    if (page.isDefault) {
      return '/';
    }

    const prefix = page.folder === undefined ? '' : (this.folderPrefixes.get(page.folder) ?? '');

    return pathForSlug([prefix, page.slug].filter(Boolean).join('/'));
  }

  private pathFor(page: PageSpec, index: number): string {
    const base = `${this.spec.permanentUrl}/${page.slug || 'home'}`;
    const path = this.pagePaths.has(base) ? `${base}#${index}` : base;
    this.pagePaths.add(path);

    return path;
  }

  private addPage(page: PageSpec, index: number): string {
    const path = this.pathFor(page, index);
    const id = page.id ?? this.nextId('page');
    this.assertFlowShapes(page.flows, `Page "${page.name}"`);
    if (page.folder !== undefined && !this.folderPrefixes.has(page.folder)) {
      throw new Error(
        `Page "${page.name}" is in folder "${page.folder}", which this space does not declare${didYouMean(page.folder, [...this.folderPrefixes.keys()])}`
      );
    }

    const element: Element = {
      id,
      attributes: {
        slug: page.slug,
        default: page.isDefault ?? index === 0,
        name: page.name,
        ...(page.folder === undefined ? {} : { folder: page.folder }),
        ...layoutAttributes(page.layout),
        ...(page.accessLevel ? { accessLevel: page.accessLevel } : {}),
        ...(page.unauthorizedRedirect
          ? { unauthorizedBehaviour: 'redirect', unauthorizedPageRedirect: page.unauthorizedRedirect }
          : {}),
        seoEnabled: Boolean(page.seoTitle ?? page.seoDescription),
        ...(page.seoTitle ? { seoPageTitle: page.seoTitle } : {}),
        ...(page.seoDescription ? { seoPageDescription: page.seoDescription } : {})
      },
      definition: {
        label: 'Page',
        type: 'page',
        rootId: id,
        items: [],
        styleSelectors: {
          base: this.selectorFor(path, { type: 'page', css: page.css, class: page.class, selector: page.selector })
        },
        ...(page.flows ? { interactions: authorFlows(page.flows, id) } : {})
      }
    };

    // `custom` is the one drop position that inserts without a parent, which is what a page is.
    this.insert(element, '', 'custom', path);

    this.handles[id] = {
      id,
      type: 'page',
      pageId: id,
      selector: selectorFor(id),
      named: page.id !== undefined,
      slug: page.slug,
      path: this.routeFor(page),
      ...(page.accessLevel ? { accessLevel: page.accessLevel } : {}),
      params: getSlugParams(page.slug),
      elements: {}
    };

    page.body.forEach((child, childIndex) => this.addElement(child, `${path}/${childIndex}`, id, id));

    return id;
  }

  /**
   * A shell pages render inside: a root of its own, written like a page but listed as none.
   *
   * It is inserted with no parent, the way a page is, and its elements carry it as their `rootId` — which is what
   * the validator and the builder read to tell a shell's elements from a page's. It is never in `schema.pages`:
   * it has no route, and a visitor only ever reaches it through a page that names it.
   */
  private addLayout(layout: LayoutSpec): void {
    const path = `${this.spec.permanentUrl}/layout:${layout.id}`;
    const where = `Layout "${layout.id}"`;
    this.assertFlowShapes(layout.flows, where);
    if (layout.folder && !this.folderPrefixes.has(layout.folder)) {
      throw new Error(
        `${where} is filed in folder "${layout.folder}", which this space does not declare${didYouMean(layout.folder, [...this.folderPrefixes.keys()])}`
      );
    }

    const bindings = withVisibility({ bind: layout.bind });
    const sourceIndex = this.options.sourceTypes ? this.sources : undefined;
    const element: Element = {
      id: layout.id,
      attributes: {
        // The one attribute the element declares a default for, merged the way a factory merges it.
        subType: 'div',
        ...layout.attributes,
        ...(layout.folder ? { folder: layout.folder } : {}),
        ...layoutAttributes(layout.layout)
      },
      definition: {
        label: layout.label ?? 'Layout Container',
        type: 'layoutContainer',
        rootId: layout.id,
        items: [],
        styleSelectors: { base: this.selectorFor(path, { type: 'layoutContainer', ...layout }) },
        initialState: { visibility: true },
        ...(bindings ? { bindings: groupBindings(path, bindings, sourceIndex, where) } : {}),
        ...(layout.flows ? { interactions: authorFlows(layout.flows, layout.id) } : {})
      }
    };

    this.insert(element, '', 'custom', path);
    this.layoutHandles[layout.id] = {
      id: layout.id,
      type: 'layoutContainer',
      pageId: layout.id,
      selector: selectorFor(layout.id),
      named: true,
      elements: {}
    };
    layout.body.forEach((child, index) => this.addElement(child, `${path}/${index}`, layout.id, layout.id));
  }

  /**
   * A page's shell has to be a layout, and its slot an element inside THAT layout.
   *
   * Both are plain strings in the document and the runtime asks nothing of them: a slot that is not inside the
   * shell renders the shell with the page nowhere in it, and every check below this one considers that valid.
   */
  private assertLayoutRef(layout: LayoutRef | undefined, where: string): void {
    if (!layout) {
      return;
    }

    const declared = (this.spec.layouts ?? []).map(candidate => candidate.id);
    if (!declared.includes(layout.id)) {
      throw new Error(
        `${where} renders inside the layout "${layout.id}", which this space does not declare${didYouMean(layout.id, declared)}`
      );
    }

    const slot = this.flatMap.flat[layout.slot] as Element | undefined;
    if (!slot || slot.definition.rootId !== layout.id || slot.id === layout.id) {
      throw new Error(
        `${where} puts its body in "${layout.slot}", which is not an element inside the layout "${layout.id}". The slot is where the body goes, so it has to be part of the shell.`
      );
    }
  }

  /**
   * The type's other selectors, empty: each one is a `plitzi__<type>-<slot>` class on the element's own markup.
   *
   * Named or not, the element wears them — that is what a space's per-type `slots` style addresses. A modal whose
   * document did not mention `rootContainer` was the SDK's white default in a dark theme, beside a modal that styled
   * the slot itself and so followed the space.
   */
  private declaredSlots(type: string): Record<string, string> {
    const slots = this.options.slotNames?.[type] ?? [];

    return Object.fromEntries(slots.map(slot => [slot, '']));
  }

  private slotSelectors(spec: ElementSpec, path: string): Record<string, string> {
    return Object.fromEntries(
      Object.entries(spec.slots ?? {}).map(([slot, value]) => {
        const names = classNames(value);
        names.forEach(name => this.assertClass(name, `Slot "${slot}" of element "${spec.type}" at ${path}`));

        return [slot, names.join(' ')];
      })
    );
  }

  /**
   * Files an element under the root it renders in: its page, or the layout shell it belongs to.
   *
   * A layout's elements go under the layout and never under a page, because they render on every page that names
   * it — filed under one, a suite would look for the header only there. An element whose root is neither is dropped
   * rather than filed somewhere plausible: a handle that resolves to the wrong root is worse than one that is absent,
   * which the lookup reports by name.
   */
  private recordHandle(handle: ElementHandle): void {
    // `hasOwn` rather than a falsy check: an index signature types every read as a hit, so this is the only way to
    // ask whether a root has an entry at all.
    if (Object.hasOwn(this.handles, handle.pageId)) {
      this.handles[handle.pageId].elements[handle.id] = handle;

      return;
    }

    if (Object.hasOwn(this.layoutHandles, handle.pageId)) {
      this.layoutHandles[handle.pageId].elements[handle.id] = handle;
    }
  }

  private addElement(
    spec: ElementSpec,
    path: string,
    rootId: string,
    parentId: string,
    insideCondition = false
  ): string {
    this.assertElementShape(spec, path);
    const id = spec.id ?? this.nextId(spec.type);
    const where = `Element "${spec.type}" (${id}) at ${path}`;
    this.assertFlowShapes(spec.flows, where);
    const bindings = withVisibility(spec);
    const conditional = insideCondition || spec.visible !== undefined || hasVisibilityBinding(bindings);
    const ancestors = this.ancestorsOf(parentId);
    bindings?.forEach(binding => assertBindingShape(binding, where));
    const sourceIndex = this.options.sourceTypes ? this.sources : undefined;

    const element: Element = {
      id,
      attributes: spec.attributes ?? {},
      definition: {
        label: spec.meta?.label ?? spec.type,
        type: spec.type,
        rootId,
        parentId,
        items: [],
        // A slot names a class outright: it dresses a part of an element that already exists, and a selector of
        // its own per control would write the same rule once per input on the page.
        styleSelectors: {
          base: this.selectorFor(path, spec),
          ...this.declaredSlots(spec.type),
          ...this.slotSelectors(spec, path)
        },
        initialState: {
          /**
           * An element with a CONDITION starts hidden, and one without starts on screen.
           *
           * "Visible when X" plainly means "not otherwise", and the binding cannot say so on its own: a source
           * that resolves to nothing writes nothing, and an absent `visibility` is read as visible. So a panel
           * waiting on a selection nobody has made yet, or on any state that only exists once the page is live,
           * was authored on screen with placeholder text in it until something happened.
           *
           * A visibility binding written by hand keeps its element on screen until it answers, as it always has —
           * spaces rely on that (a sidebar's logo bound to a state nobody sets until the sidebar is folded). A
           * computed one that should wait for its data says so with \`visible: false\`; see
           * \`warnConditionStartsVisible\`.
           */
          visibility: spec.visible === undefined,
          ...(spec.variant ? { styleVariant: { [this.variantOwner(spec, spec.variant)]: { base: spec.variant } } } : {})
        },
        ...(spec.runtime ? { runtime: spec.runtime } : {}),
        ...(spec.loadStrategy ? { loadStrategy: spec.loadStrategy } : {}),
        ...(bindings ? { bindings: groupBindings(path, bindings, sourceIndex, where) } : {}),
        ...(spec.flows ? { interactions: authorFlows(spec.flows, id) } : {})
      }
    };

    this.insert(element, parentId, 'inside', path);

    this.recordHandle({
      id,
      type: spec.type,
      pageId: rootId,
      selector: selectorFor(id),
      named: spec.id !== undefined,
      ...(conditional ? { conditional: true } : {}),
      ...([...ancestors].some(ancestor => this.flatMap.flat[ancestor].definition.type === 'list')
        ? { repeated: true }
        : {}),
      ...(rendersNoTag(element) ? { boxless: true } : {})
    });

    spec.children?.forEach((child, index) => this.addElement(child, `${path}/${index}`, rootId, id, conditional));

    return id;
  }
}

/**
 * Build a space's two documents from a declaration. Throws if the result would not be a valid space.
 *
 * `options.vocabulary` is what lets it check the flows as well as the tree. `@plitzi/sdk-authoring` — the package
 * that composes this one with the elements and the interactions — supplies the real one, so importing from there is
 * all it takes.
 */
export const authorSpace = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): AuthoredSpace =>
  new SpaceAuthor(spec, options).author();
