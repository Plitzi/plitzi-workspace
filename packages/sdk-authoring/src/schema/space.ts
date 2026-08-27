import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import { BREAKPOINTS, className, css, sameRules, toResponsive } from '../style';
import { GLOBAL_SOURCES, groupBindings, withVisibility } from './bindings';
import { authorFlows } from './flows';
import { digest } from './ids';
import { didYouMean } from './suggest';
import { assertSpaceValid } from './validate';

import type { SourceIndex } from './bindings';
import type {
  AuthorSpaceOptions,
  AuthoredSpace,
  ElementSpec,
  ElementStyleSpec,
  PageSpec,
  SpaceSpec,
  StepSpec,
  StepVocabulary
} from './types';
import type { CssSpec, ResponsiveStyle, StyleDeclaration, StyleRules } from '../style';
import type { SchemaValidationError } from '@plitzi/sdk-schema/helpers/schemaValidator';
import type { DropPosition, Element, Schema, Style, StyleItem } from '@plitzi/sdk-shared';

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

const declarationsToCss = (rules: StyleRules): string =>
  Object.entries(rules)
    .map(([property, value]) => `${property}:${String(value)};`)
    .join('');

const classCss = (selector: string, rules: StyleRules): string => `.${selector}{${declarationsToCss(rules)}}`;

const elementCss = (type: string, base: StyleRules, variants: Record<string, StyleRules>): string => {
  const variantCss = Object.entries(variants)
    .map(([name, rules]) => `&[data-variant="${name}"],&.${type}--${name}{${declarationsToCss(rules)}}`)
    .join('');

  return `.plitzi__${type}{${declarationsToCss(base)}${variantCss}}`;
};

class SpaceAuthor {
  private readonly flatMap = new FlatMap({ flat: {}, variables: [] });

  private readonly platform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };

  private readonly idCounters = new Map<string, number>();

  /** Every name the AUTHOR wrote, collected before the tree is built so a derived `<type>-<n>` never lands on one. */
  private readonly authorNames = new Set<string>();

  private readonly pagePaths = new Set<string>();

  /** Every class this space declares, whether from `classes` or from a `styles()` declaration found in the tree. */
  private readonly classRules = new Map<string, ResponsiveStyle>();

  /** Every element in this space that publishes a data source, by id, and the name it publishes it under. */
  private readonly sources: SourceIndex = new Map();

  /** Steps this space names that the vocabulary could not vouch for. Handed back rather than thrown: a plugin is
   *  free to register a module of its own, and refusing what this process cannot see would make the check useless
   *  for exactly the spaces that need it most. */
  private readonly stepWarnings: SchemaValidationError[] = [];

  constructor(
    private readonly spec: SpaceSpec,
    private readonly options: AuthorSpaceOptions = {}
  ) {}

  author(): AuthoredSpace {
    for (const [type, elementSpec] of Object.entries(this.spec.elements ?? {})) {
      this.writeElementDefaults(type, elementSpec);
    }

    for (const [name, rules] of Object.entries(this.spec.classes ?? {})) {
      this.declareClass(name, rules, 'The space-wide `classes`');
    }

    // Before the tree is written, so the stylesheet is whole by the time anything names a class and a name that
    // means two different things is refused at the declaration rather than at whichever use happened to be second.
    this.spec.pages.forEach(page => this.collectDeclarations(page));

    // Same reason, for the other thing an element names by a name declared elsewhere: a binding may read a
    // provider written further down the page than the element reading it. The author's own names are collected in
    // the same pass, so a derived `<type>-<n>` never claims a name written further down.
    this.spec.pages.forEach(page => {
      if (page.id) {
        this.authorNames.add(page.id);
      }

      page.body.forEach(child => this.collectSources(child));
    });

    for (const [name, responsive] of this.classRules) {
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
      settings: { ...this.spec.settings, customCss: this.spec.customCss ?? '' },
      ...(this.spec.rsc ? { rsc: this.spec.rsc } : {}),
      pages,
      pageFolders: []
    };

    // The gate, and the same one anybody else's documents go through. An authored space that cannot pass it is a
    // bug in the declaration, and finding out at seed time beats finding out at render time.
    //
    // `FlatMap.assertValid` is deliberately not also called here: it validates the flat map with no pages
    // attached, which is a strictly weaker reading of the same document than the pair below.
    const warnings = assertSpaceValid({ schema, style }, `authored space "${this.spec.permanentUrl}"`, {
      sourceTypes: this.options.sourceTypes
    });

    return { schema, style, warnings: [...this.stepWarnings, ...warnings] };
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
    const base = css(spec.base ?? {});
    const variants = Object.fromEntries(Object.entries(spec.variants ?? {}).map(([name, rules]) => [name, css(rules)]));

    this.platform.desktop[type] = {
      name: type,
      type: 'element',
      componentType: type,
      attributes: {
        base: {
          default: base,
          ...(spec.variants
            ? {
                variants: Object.fromEntries(
                  Object.entries(variants).map(([name, rules]) => [name, { default: rules }])
                )
              }
            : {})
        }
      },
      cache: elementCss(type, base, variants)
    };
  }

  /**
   * Adds a class to the space's stylesheet, or agrees it is already there.
   *
   * A `styles()` declaration is normally named in many places and often reached from more than one module, so
   * arriving twice is the ordinary case and not an error. Arriving twice saying DIFFERENT things is: a class name
   * that means one thing on one page and another somewhere else is a rule that silently depends on which file the
   * bundler reached first, which is the shape of bug this whole surface exists to make impossible.
   */
  private declareClass(name: string, rules: CssSpec, where: string): void {
    const responsive = toResponsive(rules);
    const existing = this.classRules.get(name);
    if (!existing) {
      this.classRules.set(name, responsive);

      return;
    }

    if (!sameRules(existing, responsive)) {
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
  private collectDeclarations(page: PageSpec): void {
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

    collect(page.class, `Page "${page.name}"`);
    page.body.forEach(walk);
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

  /**
   * A shared class when one was named, otherwise a selector of this element's own, named after where it sits.
   *
   * The two are exclusive because an element has exactly one base selector: asking for a shared rule AND a rule of
   * its own is a question with no answer, and the old behaviour — keep the class, drop the rules — is the kind of
   * silence this whole surface exists to remove.
   */
  private selectorFor(path: string, spec: { type: string; class?: string | StyleDeclaration; css?: CssSpec }): string {
    if (spec.class) {
      const name = className(spec.class);
      this.assertClass(name, `Element "${spec.type}" at ${path}`);

      if (spec.css) {
        throw new Error(
          `Element "${spec.type}" at ${path} declares both a shared class ("${name}") and css of its own. An element has one base selector: either write the rules into the class, or drop the class and keep the css.`
        );
      }

      return name;
    }

    const selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}`, 4)}`;
    this.writeSelector(selector, toResponsive(spec.css));

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
  private pathFor(page: PageSpec, index: number): string {
    const base = `${this.spec.permanentUrl}/${page.slug || 'home'}`;
    const path = this.pagePaths.has(base) ? `${base}#${index}` : base;
    this.pagePaths.add(path);

    return path;
  }

  private addPage(page: PageSpec, index: number): string {
    const path = this.pathFor(page, index);
    this.assertStepsKnown(page.flows, `Page "${page.name}"`);
    const id = page.id ?? this.nextId('page');

    const element: Element = {
      id,
      attributes: {
        slug: page.slug,
        default: page.isDefault ?? index === 0,
        name: page.name,
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
        styleSelectors: { base: this.selectorFor(path, { type: 'page', css: page.css, class: page.class }) },
        ...(page.flows ? { interactions: authorFlows(page.flows, id) } : {})
      }
    };

    // `custom` is the one drop position that inserts without a parent, which is what a page is.
    this.insert(element, '', 'custom');

    page.body.forEach((child, childIndex) => this.addElement(child, `${path}/${childIndex}`, id, id));

    return id;
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

  private addElement(spec: ElementSpec, path: string, rootId: string, parentId: string): string {
    const id = spec.id ?? this.nextId(spec.type);
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
        ...(bindings ? { bindings: groupBindings(path, bindings, sourceIndex, where) } : {}),
        ...(spec.flows ? { interactions: authorFlows(spec.flows, id) } : {})
      }
    };

    this.insert(element, parentId, 'inside');

    spec.children?.forEach((child, index) => this.addElement(child, `${path}/${index}`, rootId, id));

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
