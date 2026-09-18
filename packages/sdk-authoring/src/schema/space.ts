import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { parseSpaceFont } from '@plitzi/sdk-shared/style/fontValidation';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import processSelector from '@plitzi/sdk-style/helpers/processSelector';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { BREAKPOINTS, className, sameBlocks, toBlocks } from '../style';
import { GLOBAL_SOURCES, groupBindings, withVisibility } from './bindings';
import { authorFlows } from './flows';
import { buildHandles, pathForSlug, selectorFor } from './handles';
import { digest } from './ids';
import { didYouMean } from './suggest';
import { assertSpaceValid } from './validate';

import type { SourceIndex } from './bindings';
import type { ElementHandle, PageHandle } from './handles';
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
  StepSpec,
  StepVocabulary
} from './types';
import type { CssSpec, ResponsiveBlock, StatesSpec, StyleDeclaration } from '../style';
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
 * before it is handed back. This module is the only thing in the SDK that writes a schema document: every other
 * authoring fragment produces specs, and specs are inert until they reach here.
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
  /** Each folder's route prefix, resolved through its parents. Filled before any page is written. */
  private readonly folderPrefixes = new Map<string, string>();

  /**
   * What a test will address this space by, collected as the tree is written rather than walked again afterwards.
   *
   * Here and not in a second pass because this is the only place that knows an element's FINAL id: a spec may leave
   * it out, and the derived `<type>-<n>` exists nowhere until it is minted below.
   */
  private readonly handles: Record<string, PageHandle> = {};

  /** Every class this space declares, whether from `classes` or from a `styles()` declaration found in the tree. */
  private readonly classRules = new Map<string, ResponsiveBlock>();

  /** Every element in this space that publishes a data source, by id, and the name it publishes it under. */
  private readonly sources: SourceIndex = new Map();

  /** Steps this space names that the vocabulary could not vouch for. Handed back rather than thrown: a plugin is
   *  free to register a module of its own, and refusing what this process cannot see would make the check useless
   *  for exactly the spaces that need it most. */
  private readonly stepWarnings: SchemaValidationError[] = [];

  /** Rules that render, and render differently from what they plainly mean — see `warnTabletOnly`. */
  private readonly styleWarnings: SchemaValidationError[] = [];

  constructor(
    private readonly spec: SpaceSpec,
    private readonly options: AuthorSpaceOptions = {}
  ) {}

  author(): AuthoredSpace {
    for (const [type, elementSpec] of Object.entries(this.spec.elements ?? {})) {
      this.writeElementDefaults(type, elementSpec);
    }

    for (const [name, rules] of Object.entries(this.spec.classes ?? {})) {
      this.declareClass(name, toBlocks(rules), 'The space-wide `classes`');
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
      this.writeSelector(name, responsive, `Class "${name}"`);
    }

    const pageFolders = this.buildPageFolders();
    layouts.forEach(layout => this.addLayout(layout));
    const pages = this.spec.pages.map((page, index) => this.addPage(page, index));
    // After every root is written, because a slot is an element INSIDE a layout and a layout may be named by one
    // declared further down.
    layouts.forEach(layout => this.assertLayoutRef(layout.layout, `Layout "${layout.id}"`));
    this.spec.pages.forEach(page => this.assertLayoutRef(page.layout, `Page "${page.name}"`));

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
      settings: { ...this.spec.settings, customCss: this.spec.customCss ?? '' },
      ...(this.spec.rsc ? { rsc: this.spec.rsc } : {}),
      pages,
      pageFolders
    };

    // The gate, and the same one anybody else's documents go through. An authored space that cannot pass it is a
    // bug in the declaration, and finding out at seed time beats finding out at render time.
    //
    // `FlatMap.assertValid` is deliberately not also called here: it validates the flat map with no pages
    // attached, which is a strictly weaker reading of the same document than the pair below.
    const warnings = assertSpaceValid({ schema, style }, `authored space "${this.spec.permanentUrl}"`, {
      sourceTypes: this.options.sourceTypes
    });

    return {
      schema,
      style,
      handles: buildHandles(this.handles),
      warnings: [...this.stepWarnings, ...this.styleWarnings, ...warnings]
    };
  }

  /**
   * A step has to name something that exists, and this is the only place that can tell.
   *
   * The runtime resolves a global callback as `callbacksAvailables[<on>][<action>]`, and neither half is checkable
   * by looking at the document: they are two strings. When they name nothing, the control they are attached to
   * simply does nothing — no error, no warning, no failed request. That is how three auth builders shipped writing
   * `authLogin` at a runtime that had registered `login`.
   *
   * Refused only when the vocabulary can PROVE it wrong — a known action on the wrong module, a known utility given
   * one. An action the catalog has never heard of is a warning instead, because a plugin may register a module of
   * its own and this process cannot see it.
   *
   * Triggers, element callbacks and tasks are left alone on purpose: an element type publishes its own triggers and
   * callbacks, and a task belongs to whatever server runs the flow. None of them are knowable from here.
   */
  private assertStepsKnown(flows: StepSpec[][] | undefined, where: string): void {
    const vocabulary = this.options.vocabulary;
    if (!vocabulary || !flows) {
      return;
    }

    for (const steps of flows) {
      for (const step of steps) {
        if (step.type === 'globalCallback') {
          this.assertGlobalCallback(step, vocabulary, where);
        }

        if (step.type === 'utility') {
          this.assertUtility(step, vocabulary, where);
        }
      }
    }
  }

  private assertGlobalCallback(step: StepSpec, vocabulary: StepVocabulary, where: string): void {
    const declared = vocabulary.globalCallbacks[step.action] as { source: string } | undefined;
    if (!declared) {
      this.stepWarnings.push({
        code: 'unknown-global-callback',
        message: `${where} runs the global callback "${step.action}", which no built-in source declares. It resolves at run time only if something registers it — a plugin, or a module this space brings itself.`,
        details: { action: step.action, on: step.on }
      });

      return;
    }

    // A global callback registers under its source MODULE, never under the element hosting the flow — and a step
    // with no target at all is written into the document as `elementId: null`, which resolves to nothing.
    if (step.on !== declared.source) {
      throw new Error(
        `${where} runs the global callback "${step.action}" on ${step.on === undefined ? 'no module' : `"${step.on}"`}, but it is registered on "${declared.source}". A global callback names the module that registered it, never the element the flow sits on — the step builders fill this in.`
      );
    }
  }

  private assertUtility(step: StepSpec, vocabulary: StepVocabulary, where: string): void {
    if (!Object.hasOwn(vocabulary.utilities, step.action)) {
      this.stepWarnings.push({
        code: 'unknown-utility',
        message: `${where} runs the utility "${step.action}", which is not one of the built-in utilities.`,
        details: { action: step.action }
      });

      return;
    }

    // The one kind of step where naming a target is the mistake: the runtime resolves a utility by action alone.
    if (step.on !== undefined) {
      throw new Error(
        `${where} runs the utility "${step.action}" on "${step.on}". A utility is resolved by its action alone and takes no module — drop the \`on\`.`
      );
    }
  }

  private writeElementDefaults(type: string, spec: ElementStyleSpec): void {
    const base = toBlocks({ css: spec.base ?? {}, states: spec.states, variants: spec.variants });
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
  private collectDeclarations(
    rootClass: string | StyleDeclaration | undefined,
    body: ElementSpec[],
    rootWhere: string
  ): void {
    const collect = (value: string | StyleDeclaration | undefined, where: string): void => {
      if (value && typeof value !== 'string') {
        this.declareClass(value.name, value.rules, where);
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
      `${where} names the class "${name}", which this space does not declare${didYouMean(name, classes)}. Declare it in \`classes\`, hand it a \`styles()\` declaration, or write the rules inline with \`css\`.`
    );
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
   * A shared class when one was named, otherwise a selector of this element's own, named after where it sits.
   *
   * The two are exclusive because an element has exactly one base selector: asking for a shared rule AND a rule of
   * its own is a question with no answer, and the old behaviour — keep the class, drop the rules — is the kind of
   * silence this whole surface exists to remove.
   */
  private selectorFor(
    path: string,
    spec: { type: string; class?: string | StyleDeclaration; css?: CssSpec; states?: StatesSpec }
  ): string {
    if (spec.class) {
      const name = className(spec.class);
      this.assertClass(name, `Element "${spec.type}" at ${path}`);

      if (spec.css || spec.states) {
        throw new Error(
          `Element "${spec.type}" at ${path} declares both a shared class ("${name}") and ${spec.css ? 'css' : 'states'} of its own. An element has one base selector: either write the rules into the class, or drop the class and keep the rules.`
        );
      }

      return name;
    }

    // A class may carry any name — one read back from a builder document is `container-555c` — so the name derived
    // for an element's own rules steps past a class that already answers to it rather than overwriting its rules.
    let selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}`, 4)}`;
    for (let attempt = 1; this.classRules.has(selector); attempt += 1) {
      selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}#${attempt}`, 4)}`;
    }

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
  private insert(element: Element, to: string, position: DropPosition): void {
    if (!this.flatMap.addElement(element, to, position)) {
      throw new Error(
        `Could not author element "${element.id}" (${element.definition.type}): the schema refused it, which usually means another element already answers to that name`
      );
    }
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
    this.assertStepsKnown(page.flows, `Page "${page.name}"`);
    if (page.folder !== undefined && !this.folderPrefixes.has(page.folder)) {
      throw new Error(
        `Page "${page.name}" is in folder "${page.folder}", which this space does not declare${didYouMean(page.folder, [...this.folderPrefixes.keys()])}`
      );
    }

    const id = page.id ?? this.nextId('page');

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
        ...(page.keepState === undefined ? {} : { keepState: page.keepState }),
        ...(page.stateStorage ? { stateStorage: page.stateStorage } : {}),
        seoEnabled: Boolean(page.seoTitle ?? page.seoDescription),
        ...(page.seoTitle ? { seoPageTitle: page.seoTitle } : {}),
        ...(page.seoDescription ? { seoPageDescription: page.seoDescription } : {})
      },
      definition: {
        label: 'Page',
        type: 'page',
        rootId: id,
        items: [],
        styleSelectors: { base: this.selectorFor(path, { type: 'page', css: page.css, class: page.class }) },
        ...(page.flows ? { interactions: authorFlows(page.flows, id) } : {})
      }
    };

    // `custom` is the one drop position that inserts without a parent, which is what a page is.
    this.insert(element, '', 'custom');

    this.handles[id] = {
      id,
      type: 'page',
      pageId: id,
      selector: selectorFor(id),
      named: page.id !== undefined,
      slug: page.slug,
      path: this.routeFor(page),
      ...(page.accessLevel ? { accessLevel: page.accessLevel } : {}),
      params: [...page.slug.matchAll(/\{\{\s*([^\s}]+)\s*\}\}/g)].map(([, param]) => param),
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
    this.assertStepsKnown(layout.flows, where);
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

    this.insert(element, '', 'custom');
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

  private slotSelectors(spec: ElementSpec, path: string): Record<string, string> {
    return Object.fromEntries(
      Object.entries(spec.slots ?? {}).map(([slot, value]) => {
        const name = className(value);
        this.assertClass(name, `Slot "${slot}" of element "${spec.type}" at ${path}`);

        return [slot, name];
      })
    );
  }

  /**
   * Files an element under the page it renders on.
   *
   * `rootId` is that page for everything a page contains — a layout container included, since it is a root the page
   * names rather than a page of its own. An element whose root is not a page it wrote is dropped rather than filed
   * somewhere plausible: a handle that resolves to the wrong page is worse than one that is absent, which the
   * lookup reports by name.
   */
  private recordHandle(handle: ElementHandle): void {
    // `hasOwn` rather than a falsy check: an index signature types every read as a hit, so this is the only way to
    // ask whether a root that is not one of this space's pages has an entry at all.
    if (Object.hasOwn(this.handles, handle.pageId)) {
      this.handles[handle.pageId].elements[handle.id] = handle;
    }
  }

  private addElement(
    spec: ElementSpec,
    path: string,
    rootId: string,
    parentId: string,
    insideCondition = false
  ): string {
    const id = spec.id ?? this.nextId(spec.type);
    const conditional = insideCondition || spec.visible !== undefined;
    const where = `Element "${spec.type}" (${id}) at ${path}`;
    this.assertStepsKnown(spec.flows, where);
    const bindings = withVisibility(spec);
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
        styleSelectors: { base: this.selectorFor(path, spec), ...this.slotSelectors(spec, path) },
        initialState: {
          /**
           * An element with a CONDITION starts hidden, and one without starts on screen.
           *
           * "Visible when X" plainly means "not otherwise", and the binding cannot say so on its own: a source
           * that resolves to nothing writes nothing, and an absent `visibility` is read as visible. So a panel
           * waiting on a selection nobody has made yet, or on any state that only exists once the page is live,
           * was authored on screen with placeholder text in it until something happened.
           */
          visibility: spec.visible === undefined,
          ...(spec.variant ? { styleVariant: { [spec.type]: { base: spec.variant } } } : {})
        },
        ...(spec.runtime ? { runtime: spec.runtime } : {}),
        ...(spec.loadStrategy ? { loadStrategy: spec.loadStrategy } : {}),
        ...(bindings ? { bindings: groupBindings(path, bindings, sourceIndex, where) } : {}),
        ...(spec.flows ? { interactions: authorFlows(spec.flows, id) } : {})
      }
    };

    this.insert(element, parentId, 'inside');

    this.recordHandle({
      id,
      type: spec.type,
      pageId: rootId,
      selector: selectorFor(id),
      named: spec.id !== undefined,
      ...(conditional ? { conditional: true } : {})
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
