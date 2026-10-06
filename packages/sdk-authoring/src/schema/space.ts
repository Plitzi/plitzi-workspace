import { propNameProblem, RESERVED_PROP_NAMES } from '@plitzi/sdk-schema/helpers/components';
import { isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';
import { parentChain } from '@plitzi/sdk-schema/helpers/elementTree';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { rendersNoTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';
import { checkVisitorRoles } from '@plitzi/sdk-shared/auth/visitorRoles';
import { invalidParams } from '@plitzi/sdk-shared/authoring/paramSpec';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { getSlugParams } from '@plitzi/sdk-shared/navigation';
import { channelProblems } from '@plitzi/sdk-shared/realtime';
import { anchorOf } from '@plitzi/sdk-shared/schema/anchor';
import { parseSpaceFont } from '@plitzi/sdk-shared/style/fontValidation';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import processSelector from '@plitzi/sdk-style/helpers/processSelector';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import {
  BREAKPOINTS,
  classNames,
  classRefs,
  isStyleDeclaration,
  modifierClassName,
  sameBlocks,
  splitClassList,
  toBlocks
} from '../style';
import { suggestSpace } from './advice';
import { contentMoves } from './advice/content';
import {
  COMPONENT_SOURCES,
  GLOBAL_SOURCES,
  groupBindings,
  hasVisibilityBinding,
  bindTemplate,
  toBindingSpecs,
  withVisibility
} from './bindings';
import { AUTHORING_CODES, AuthoringError, isSuggestionCode } from './codes';
import { flagGateOf } from './flags';
import { authorFlows, flowStepIds } from './flows';
import {
  COMPONENT_SPEC_KEYS,
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
import { buildHandles, instanceSelectorFor, pathForSlug, selectorFor } from './handles';
import { digest } from './ids';
import { fixSpace, lintSpace } from './lint';
import { CUSTOM_TYPE } from './lint/context';
import { MAIN_ATTRIBUTES } from './mainAttributes';
import { withNotificationsCss } from './notifications';
import { refusalOf, SpaceRefusedError } from './refusals';
import { didYouMean } from './suggest';
import { assertSpaceValid, validateSpace } from './validate';
import { writtenAt, writtenAtPosition } from './writtenAt';

import type { SourceIndex } from './bindings';
import type { WarningCode } from './codes';
import type { ElementHandle, LayoutHandle, PageHandle } from './handles';
import type { FixChange } from './lint';
import type { SpaceRefusal } from './refusals';
import type {
  AuthorSpaceOptions,
  AuthoredSpace,
  ComponentSpec,
  BindingsSpec,
  ElementSpec,
  ElementStyleSpec,
  LayoutRef,
  LayoutSpec,
  PageFolderSpec,
  PageSpec,
  SpaceSpec,
  StepSpec
} from './types';
import type { WrittenPosition } from './writtenAt';
import type {
  ClassList,
  CssSpec,
  ElementClassList,
  ResponsiveBlock,
  StatesSpec,
  StyleDeclaration,
  StyleSpec
} from '../style';
import type { SchemaValidationError } from '@plitzi/sdk-schema/helpers/schemaValidator';
import type {
  DropPosition,
  Element,
  PageFolder,
  Schema,
  SpaceComponent,
  SpaceFont,
  Style,
  StyleItem
} from '@plitzi/sdk-shared';

/** What a page field nobody takes was probably for: the page's own fields for search, or a setting of the space. */
const pageFieldHint = (key: string): string => {
  if (['seo', 'title', 'description'].includes(key)) {
    return ' A page’s title and description for search engines and shared links are `seoTitle` and `seoDescription`.';
  }

  return ['keepState', 'transientState', 'paintedState', 'stateStorage'].includes(key)
    ? ' Keeping state across visits is a setting of the whole space: `settings: { keepState: true }`, with `transientState` for the keys to leave out.'
    : '';
};

/** A `styles()` declaration in words: its name, and the line of the author's that wrote it when it is known. */
const declaredAt = (declaration: StyleDeclaration): string => {
  const at = writtenAt(declaration);

  return `styles('${declaration.name}')${at === undefined ? '' : ` at ${at}`}`;
};

/** The types that render their children once per item: everything inside one is repeated, one copy per row. */
const REPEATING_TYPES = new Set(['list', 'carouselTrack']);

/**
 * Where an element is written: the pages' tree, or one component's — with the sources an element there can read. A
 * component is closed, so its index holds only what its own tree publishes, and `props` is one of its globals.
 */
type AuthorTree = { map: FlatMap; sources: SourceIndex; globals: readonly string[] };

/**
 * How a person finds an element in what they wrote: its own name when it has one, otherwise the steps from the nearest
 * one that does — `"store-footer" › container[1] › text[0]` rather than a path of indices from the page down.
 */
const placeOf = (spec: unknown, parent: string, index?: number): string => {
  const record = isRecord(spec) ? spec : {};
  if (typeof record.id === 'string') {
    return `"${record.id}"`;
  }

  return index === undefined
    ? parent
    : `${parent} › ${typeof record.type === 'string' ? record.type : 'element'}[${index}]`;
};

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
  /** The spec each element was written from, by the id it got: where a fix to its document is a fix to its source. */
  private readonly specs = new Map<string, ElementSpec>();

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
  /** Where each class was first declared, in words — what a second declaration that disagrees is told it disagrees with. */
  private readonly classOrigins = new Map<string, () => string>();
  /** Every element's own selector, named or derived — each one is that element's alone. */
  private readonly ownSelectors = new Set<string>();

  /** Every element in this space that publishes a data source, by id, and the name it publishes it under. */
  private readonly sources: SourceIndex = new Map();

  /** The pages' tree — layouts included — which is where everything not inside a component is written. */
  private readonly pagesTree: AuthorTree = { map: this.flatMap, sources: this.sources, globals: GLOBAL_SOURCES };

  /** Each component's tree, by component id. */
  private readonly componentTrees = new Map<string, AuthorTree>();

  /** Rules that render, and render differently from what they plainly mean — see `warnTabletOnly`. */
  private readonly styleWarnings: (SchemaValidationError & { code: WarningCode })[] = [];
  /** What could not be written as declared, kept so the run reports all of it (see `addElement`). */
  private readonly refusals: SpaceRefusal[] = [];
  /** Elements left out of the documents for a refusal — while any is, the documents are not whole enough to lint. */
  private skipped = 0;

  constructor(
    private readonly spec: SpaceSpec,
    private readonly options: AuthorSpaceOptions = {}
  ) {}

  author(): AuthoredSpace {
    const { schema, style } = this.write();

    // The gate, and the same one anybody else's documents go through. An authored space that cannot pass it is a
    // bug in the declaration, and finding out at seed time beats finding out at render time.
    //
    // `FlatMap.assertValid` is deliberately not also called here: it validates the flat map with no pages
    // attached, which is a strictly weaker reading of the same document than the pair below.
    if (this.refusals.length > 0) {
      const allow = this.options.allow ?? [];
      const { errors } = validateSpace({ schema, style }, this.options);
      throw new SpaceRefusedError(this.spec.permanentUrl, [
        ...this.refusals,
        ...errors
          .filter(error => !allow.some(entry => entry.code === error.code && entry.element === error.elementId))
          .map(error => ({
            place: error.elementId ? `"${error.elementId}"` : '',
            code: error.code,
            message: error.message
          }))
      ]);
    }

    const warnings = assertSpaceValid(
      { schema, style },
      `authored space "${this.spec.permanentUrl}"`,
      this.options,
      this.options.allow
    );

    // Where each suggestion's first element was written, as a refusal says it: the line to go and change.
    const suggestions = suggestSpace({ schema, style }).map(suggestion => {
      const first = suggestion.elementIds.at(0);
      const at = first === undefined ? undefined : writtenAt(this.specOf(first));

      return at === undefined ? suggestion : { ...suggestion, at };
    });

    this.markConditionalByChildren(schema);

    return {
      schema,
      style,
      handles: buildHandles(this.handles, this.layoutHandles),
      warnings: [...this.styleWarnings, ...warnings],
      suggestions
    };
  }

  /**
   * An element's `quiet`: suggestions' codes, and only those — a problem is never quieted, and a misspelt code would
   * quiet nothing while reading as if it did. Writes nothing into the documents: it is about the advice, not the page.
   */
  private assertQuiet(quiet: unknown, where: string): void {
    const suggestions = Object.entries(AUTHORING_CODES)
      .filter(([, entry]) => entry.kind === 'suggested')
      .map(([code]) => code);
    const wrong = (Array.isArray(quiet) ? quiet : [quiet]).filter(code => !isSuggestionCode(code));
    if (!Array.isArray(quiet) || wrong.length > 0) {
      throw new AuthoringError(
        'quiet-unknown',
        `${where} quiets ${wrong.map(code => JSON.stringify(code)).join(', ')}, which ${wrong.length === 1 ? 'is' : 'are'} no suggestion's code: \`quiet\` is a list of the codes suggestions were offered with — ${suggestions.join(', ')}${didYouMean(String(wrong[0]), suggestions) || '.'}`
      );
    }
  }

  /** The spec an element was written from, by its id in the documents. */
  specOf(id: string): ElementSpec | undefined {
    return this.specs.get(id);
  }

  /**
   * The documents as the declaration writes them, before the gate every space goes through: what a fix is planned
   * on, since the problems a fix settles are exactly the ones that gate reports. Throws only what kept them from being
   * written at all.
   */
  write(): { schema: Schema; style: Style } {
    this.assertSpaceShape();
    for (const [type, elementSpec] of Object.entries(this.spec.elements ?? {})) {
      this.writeElementDefaults(type, elementSpec);
    }

    for (const [name, value] of Object.entries(this.spec.classes ?? {})) {
      if (!isStyleDeclaration(value)) {
        this.declareClass(name, toBlocks(value), () => `the space-wide \`classes\` entry "${name}"`);
        continue;
      }

      if (value.name !== name) {
        throw new AuthoringError(
          'class-listed-under-other-name',
          `The space-wide \`classes\` lists the declaration "${value.name}" under the name "${name}". A declaration is listed under its own name.`
        );
      }

      this.declareClass(name, value.rules, () => `${declaredAt(value)}, listed in the space-wide \`classes\``);
    }

    const layouts = this.spec.layouts ?? [];
    const components = this.spec.components ?? [];

    // Before the tree is written, so the stylesheet is whole by the time anything names a class and a name that
    // means two different things is refused at the declaration rather than at whichever use happened to be second.
    components.forEach(component =>
      this.collectDeclarations(undefined, [component.root], `component "${component.id}"`)
    );
    layouts.forEach(layout => this.collectDeclarations(layout.class, layout.body, `layout "${layout.id}"`));
    this.spec.pages.forEach(page => this.collectDeclarations(page.class, page.body, `page "${page.name}"`));

    // Same reason, for the other thing an element names by a name declared elsewhere: a binding may read a
    // provider written further down the page than the element reading it. The author's own names are collected in
    // the same pass, so a derived `<type>-<n>` never claims a name written further down.
    components.forEach(component => {
      const sources: SourceIndex = new Map();
      this.collectSources(component.root, sources);
      this.componentTrees.set(component.id, {
        map: new FlatMap({ flat: {}, variables: [] }),
        sources,
        globals: COMPONENT_SOURCES
      });
    });
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
    this.assertChannels();
    this.assertTransientState();
    this.assertPaintedState();
    this.assertVisitorRoles();
    const pageFolders = this.buildPageFolders();
    const declared = this.collecting(() => components.map(component => this.addComponent(component)));
    this.collecting(() => layouts.forEach(layout => this.addLayout(layout)));
    const pages = this.collecting(() => this.spec.pages.map((page, index) => this.addPage(page, index)));
    if (this.skipped > 0) {
      throw new SpaceRefusedError(this.spec.permanentUrl, this.refusals, { linted: false });
    }

    // After every root is written, because a slot is an element INSIDE a layout and a layout may be named by one
    // declared further down.
    layouts.forEach(layout => this.assertLayoutRef(layout.layout, `Layout "${layout.id}"`));
    this.spec.pages.forEach(page => this.assertLayoutRef(page.layout, `Page "${page.name}"`));
    // After every page is written, too: a redirect names a page that may be declared further down, by an id authoring
    // derives when it is.
    this.spec.pages.forEach((page, index) => this.writeRedirect(page, pages[index]));
    // After every element is written: a button may control one declared further down.
    this.resolveControls();
    if (pages.length === 0) {
      throw new AuthoringError(
        'no-pages',
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

    // Server data is on when the spec says so — or, saying nothing, when anything is resolved on the server: such an
    // element is never answered without it, and nothing else would turn it on.
    const serverResolved = [this.flatMap.flat, ...declared.map(component => component.flat)].some(flat =>
      Object.values(flat).some(element => element.definition.runtime === 'server')
    );
    const rsc = this.spec.rsc ?? (serverResolved ? { enabled: true } : undefined);
    const schema: Schema = {
      definition: { name: this.spec.name, permanentUrl: this.spec.permanentUrl },
      flat: this.flatMap.flat,
      variables: this.spec.schemaVariables ?? [],
      ...(this.spec.flags ? { flags: this.spec.flags } : {}),
      settings: {
        ...this.spec.settings,
        customCss: withNotificationsCss(this.spec.customCss ?? '', this.spec.notifications),
        ...(this.spec.computed ? { computed: this.spec.computed } : {}),
        ...(this.spec.channels ? { channels: this.spec.channels } : {})
      },
      ...(rsc ? { rsc } : {}),
      pages,
      pageFolders,
      components: Object.fromEntries(declared.map(component => [component.id, component]))
    };

    return { schema, style };
  }

  /**
   * Runs a writing phase. A problem it throws once elements have already been refused is one more refusal — most often
   * a consequence of them — reported with the rest rather than instead of them.
   */
  private collecting<T>(write: () => T): T {
    try {
      return write();
    } catch (error) {
      if (this.refusals.length === 0) {
        throw error;
      }

      this.refusals.push({ place: '', ...refusalOf(error) });
      throw new SpaceRefusedError(this.spec.permanentUrl, this.refusals, { linted: false });
    }
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
        throw new AuthoringError(
          'flow-empty',
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

    const owner = classNames(splitClassList(spec.class).refs).find(name =>
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
   *
   * `origin` says where, and is only asked for when there is a conflict to report: reading where an element was written
   * means formatting a stack, which every element of every space would otherwise pay for on every write.
   */
  private declareClass(name: string, blocks: ResponsiveBlock, origin: () => string): void {
    const existing = this.classRules.get(name);
    if (!existing) {
      this.classRules.set(name, blocks);
      this.classOrigins.set(name, origin);

      return;
    }

    if (!sameBlocks(existing, blocks)) {
      throw new AuthoringError(
        'class-conflict',
        `The class "${name}" is declared twice with different rules: ${this.classOrigins.get(name)?.() ?? 'once before'}, and ${origin()}. A class is one rule set per space: rename one of them, or make them agree.`
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
    const collect = (value: ClassList | undefined, usedBy: () => string): void => {
      for (const ref of value ? classRefs(value) : []) {
        if (typeof ref !== 'string') {
          this.declareClass(ref.name, ref.rules, () => `${declaredAt(ref)}, used by ${usedBy()}`);
        }
      }
    };

    const walk = (spec: ElementSpec): void => {
      const element = (): string => {
        const at = writtenAt(spec);

        return `${spec.type}${spec.id === undefined ? '' : ` "${spec.id}"`}${at === undefined ? '' : ` at ${at}`}`;
      };
      // Rules of the element's own on top of its classes are not a declaration: they are written with the element.
      collect(spec.class === undefined ? undefined : splitClassList(spec.class).refs, element);
      Object.entries(spec.slots ?? {}).forEach(([slot, value]) =>
        collect(value, () => `the "${slot}" slot of ${element()}`)
      );
      spec.children?.forEach(walk);
    };

    collect(rootClass, () => rootWhere);
    body.forEach(walk);
  }

  /**
   * Every element that publishes a data source, before anything binds to one — and every name the author wrote.
   *
   * Only elements NAMED by the author publish: a derived name is positional, so a binding naming one would move the
   * moment an element was added above it, which is why nothing is meant to refer to one. Naming the element is how
   * an author says "this is a thing other parts of the space point at".
   */
  private collectSources(spec: ElementSpec, index: SourceIndex = this.sources): void {
    if (spec.id) {
      this.authorNames.add(spec.id);
    }

    const sourceTypes = this.options.sourceTypes;
    const prefix = sourceTypes?.[spec.type];
    if (prefix && spec.id) {
      // The globals are registered for the whole space under bare names, so an element answering to one makes its
      // own source unreachable AND shadows the global for every binding in the space that meant the other one.
      if (GLOBAL_SOURCES.includes(spec.id)) {
        throw new AuthoringError(
          'id-shadows-global',
          `Element "${spec.type}" is named "${spec.id}", which is one of the global data sources (${GLOBAL_SOURCES.join(', ')}). Give it another name.`
        );
      }

      index.set(spec.id, prefix);
    }

    spec.children?.forEach(child => this.collectSources(child, index));
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

    throw new AuthoringError(
      'class-undeclared',
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

        throw new AuthoringError(
          'font-invalid',
          `Font ${index} ("${font.family}") in space "${this.spec.permanentUrl}": ${reason}`,
          {
            cause: error
          }
        );
      }
    });
  }

  /**
   * A tablet rule a phone never sees.
   *
   * The breakpoints are RANGES, not a cascade: `tablet` is 48–64rem, `mobile` is up to 48rem, and each inherits
   * only from `desktop`. So a layout that collapses to a column at tablet and says nothing for mobile comes back as
   * desktop columns on a phone — the narrowest screen gets the widest layout, and every check passes. A warning and
   * not a refusal, because a rule meant for tablets alone is legal, just rarely what anybody meant.
   */
  private warnTabletOnly(blocks: ResponsiveBlock, where: string): void {
    const tablet = blocks.tablet?.default ?? {};
    const mobile = blocks.mobile?.default ?? {};
    // Hidden on a phone, it shows nothing there for a tablet rule to have reached.
    if (mobile.display === 'none') {
      return;
    }

    const skipped = Object.keys(tablet).filter(property => !Object.hasOwn(mobile, property));
    if (skipped.length === 0) {
      return;
    }

    this.styleWarnings.push({
      code: 'tablet-rule-skips-mobile',
      message: `${where} sets ${skipped.join(', ')} for tablet but not for mobile. Tablet (48–64rem) and mobile (up to 48rem) are separate ranges and mobile inherits desktop, not tablet — so phones get the desktop value back. For both, write it once under \`compact\` (tablet and mobile together); repeat it under \`mobile\` otherwise.`,
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
      throw new AuthoringError(
        'selector-invalid',
        `${where} names its selector "${name}", which is not a CSS class name.`
      );
    }

    if (this.classRules.has(name) || this.ownSelectors.has(name)) {
      throw new AuthoringError(
        'selector-taken',
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
    spec: {
      id?: string;
      type: string;
      class?: ElementClassList;
      css?: CssSpec;
      states?: StatesSpec;
      selector?: string;
    },
    place = path
  ): string {
    // Refused, and written with the class it wears, so the element is still there for the rest of the checks.
    if (spec.class && spec.selector) {
      this.refusals.push({
        place,
        at: writtenAt(spec),
        code: 'class-and-selector',
        message: `Element "${spec.type}" at ${place} names its own selector ("${spec.selector}") and wears a shared class. A shared class IS its selector: drop one of the two.`
      });
    }

    if (spec.class) {
      const { refs, modifiers } = splitClassList(spec.class);
      const names = classNames(refs);
      names.forEach(name => this.assertClass(name, `Element "${spec.type}" at ${place}`));

      if (spec.css || spec.states) {
        this.refusals.push({
          place,
          at: writtenAt(spec),
          code: 'class-and-css',
          message: `Element "${spec.type}" at ${place} declares both a shared class ("${names.join(' ')}") and ${spec.css ? 'css' : 'states'} of its own. An element has one base selector: put the rules on top of the class instead — \`class: [${names[0] ?? 'card'}, { … }]\` — or into the class itself.`
        });
      }

      const modifier = this.modifierFor(spec, modifiers, place);

      return [...names, ...(modifier ? [modifier] : [])].join(' ');
    }

    // A class may carry any name — one read back from a builder document is `container-555c` — so the name derived
    // for an element's own rules steps past a class that already answers to it rather than overwriting its rules.
    if (spec.selector !== undefined) {
      this.assertOwnSelector(spec.selector, `Element "${spec.type}" at ${place}`);
      this.writeSelector(
        spec.selector,
        toBlocks({ css: spec.css, states: spec.states }),
        `Element "${spec.type}" at ${place}`
      );

      return spec.selector;
    }

    let selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}`, 4)}`;
    for (let attempt = 1; this.classRules.has(selector) || this.ownSelectors.has(selector); attempt += 1) {
      selector = `${spec.type}-${digest(`plitzi:selector:${this.spec.permanentUrl}:${path}#${attempt}`, 4)}`;
    }

    this.ownSelectors.add(selector);

    this.writeSelector(
      selector,
      toBlocks({ css: spec.css, states: spec.states }),
      `Element "${spec.type}" at ${place}`
    );

    return selector;
  }

  /**
   * The class an element's own rules on top of its classes become — `<id>--own`, written after every shared class so it
   * wins over them. One set per element, and only on an element with an `id`, which is what names it for good.
   */
  private modifierFor(spec: { id?: string; type: string }, modifiers: StyleSpec[], place: string): string | undefined {
    if (modifiers.length === 0) {
      return undefined;
    }

    const where = `Element "${spec.type}" at ${place}`;
    if (modifiers.length > 1) {
      this.refusals.push({
        place,
        at: writtenAt(spec),
        code: 'modifier-count',
        message: `${where} has ${modifiers.length} sets of rules in its class list. Write one, after its classes: \`class: [card, { opacity: '0.5', 'margin-top': '8px' }]\`.`
      });
    }

    if (spec.id === undefined) {
      this.refusals.push({
        place,
        at: writtenAt(spec),
        code: 'modifier-without-id',
        message: `${where} has rules of its own in its class list but no \`id\`. Those rules become a class named after the element, so it needs a name: \`id: 'hero-bg'\`.`
      });

      return undefined;
    }

    const name = modifierClassName(spec.id);
    this.assertOwnSelector(name, where);
    this.writeSelector(name, toBlocks(modifiers[0]), where);

    return name;
  }

  /**
   * A button's `controls` names what it shows and hides by that element's id, as every reference here does; the page
   * needs it by an id the DOM carries — an anchor. The element is given one (its id, when that is one already) and the
   * button names it. A value that already is an anchor of the space is kept as written.
   */
  private resolveControls(): void {
    const { flat } = this.flatMap;
    for (const element of Object.values(flat)) {
      const controls = element.attributes.controls;
      if (element.definition.type !== 'button' || typeof controls !== 'string' || controls === '') {
        continue;
      }

      if (!Object.hasOwn(flat, controls)) {
        if (Object.values(flat).some(other => other.definition.anchor === controls)) {
          continue;
        }

        throw new AuthoringError(
          'controls-unknown',
          `Button "${element.id}" controls "${controls}", which is no element of the space${didYouMean(controls, Object.keys(flat)) || '.'} Name the element it shows and hides by its id: \`controls: 'faq-answer'\`.`
        );
      }

      const target = flat[controls];
      const anchor = target.definition.anchor ?? anchorOf(target.id);
      target.definition.anchor = anchor;
      element.attributes.controls = anchor;
    }
  }

  /**
   * Inserts through `FlatMap`, and refuses to carry on when it declines.
   *
   * It answers `false` rather than throwing — a builder dropping an element somewhere it may not go is not an
   * exception — so an ignored return here is an element that never made it into the document while the page it
   * belonged to authors perfectly well. The reason it is nearly always declined is a name two elements share,
   * and a name written twice is worth hearing about at the line that wrote it.
   */
  private insert(element: Element, to: string, position: DropPosition, path = to, tree = this.pagesTree): void {
    const earlier = this.authoredAt.get(element.id);
    if (earlier !== undefined) {
      // A page or a layout holding the name is not a helper called twice: `scope()` would not help, a new name does.
      const holder = (tree.map.flat[element.id] as Element | undefined)?.definition.type;
      const root = holder === 'page' ? 'page' : holder === 'layoutContainer' ? 'layout' : undefined;
      throw new AuthoringError(
        'id-taken',
        root
          ? `Element "${element.id}" (${element.definition.type}) at ${path} uses the name of the ${root} at ${earlier} — ids are one namespace for the whole space, pages and layouts included. Give the element a name of its own: \`id: '${element.id}-${element.definition.type.toLowerCase()}'\`.`
          : `Element "${element.id}" (${element.definition.type}) at ${path} uses a name already taken at ${earlier}. Ids are one namespace for the whole space — layouts and every page share it — so wrap the function called more than once in \`scope('<what it is for>', ref => …)\`, which prefixes every id inside it.`
      );
    }

    if (!tree.map.addElement(element, to, position)) {
      throw new AuthoringError(
        'element-rejected',
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
      throw new AuthoringError(
        'no-pages',
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

    const componentIds = new Set<string>();
    for (const component of this.spec.components ?? []) {
      const where = `Component "${component.id}"`;
      assertKnownKeys(component, COMPONENT_SPEC_KEYS, where);
      // Read as what reached here, not what the type promises: a spec is often assembled by hand or by an agent.
      const id: unknown = component.id;
      if (typeof id !== 'string' || !isValidElementId(id)) {
        throw new AuthoringError(
          'component-id',
          `${where} needs an \`id\` that starts with a letter, then letters, numbers, hyphens and underscores — it is the name an instance places it by: \`component('${String(id)}')\`.`
        );
      }

      if (componentIds.has(component.id)) {
        throw new AuthoringError(
          'component-duplicate',
          `Two components are called "${component.id}". A component's id is the one name it is placed by.`
        );
      }

      componentIds.add(component.id);
      for (const name of Object.keys(component.props ?? {})) {
        const problem = propNameProblem(name);
        if (problem) {
          throw new AuthoringError('prop-name', `${where}: ${problem}.`);
        }
      }
    }

    for (const page of this.spec.pages) {
      const where = `Page "${page.name}"`;
      assertKnownKeys(page, PAGE_SPEC_KEYS, where, pageFieldHint);
      assertId(page.id, where);
      if (typeof page.slug !== 'string') {
        throw new AuthoringError(
          'page-without-slug',
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
      throw new AuthoringError(
        'element-shape',
        `${where} has no \`type\`. Build elements with their factories — \`text(…)\`, \`container(…)\`.`
      );
    }

    // Read as `unknown`: the type says it is an object, and this is the check for the declarations the type never saw.
    const attributes: unknown = spec.attributes;
    if (
      attributes !== undefined &&
      (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes))
    ) {
      throw new AuthoringError(
        'element-shape',
        `${where}: \`attributes\` is not an object of attribute names and values.`
      );
    }

    if (spec.children !== undefined && !Array.isArray(spec.children)) {
      throw new AuthoringError('element-shape', `${where}: \`children\` is not a list of elements.`);
    }

    assertId(spec.id, where);
  }

  /**
   * The space's computed values are written once, under `computed` — the same map in `settings` as well would leave
   * two answers to one question. What they say is `lintSpace`'s to read.
   */
  private assertComputedOnce(): void {
    if (this.spec.settings?.computed !== undefined) {
      throw new AuthoringError(
        'setting-misplaced',
        '`settings.computed` is written through `computed` at the top of the space, not inside `settings`.'
      );
    }
  }

  /**
   * The channels a space offers, checked where they are written: a pattern a page could never match, or a channel
   * with no access rule, is a channel nobody can use — refused with what to write instead.
   */
  private assertChannels(): void {
    if (this.spec.settings?.channels !== undefined) {
      throw new AuthoringError(
        'setting-misplaced',
        '`settings.channels` is written through `channels` at the top of the space, not inside `settings`.'
      );
    }

    for (const [pattern, declaration] of Object.entries(this.spec.channels ?? {})) {
      const [problem] = channelProblems(pattern, declaration);
      if (problem) {
        throw new AuthoringError('channel-declaration', `Channel "${pattern}": ${problem}.`);
      }
    }
  }

  /**
   * A setting that names `runtime.state` keys — `transientState`, `paintedState` — checked the same way: refused when it
   * could not work — not a list, an empty name, or a dotted one: the runtime compares top-level keys, so `demo.step`
   * would never match anything and the setting would do nothing at all. Answers the keys.
   */
  private stateKeyList(setting: 'transientState' | 'paintedState', example: string[], does: string): string[] {
    const listed: unknown = this.spec.settings?.[setting];
    if (listed === undefined) {
      return [];
    }

    if (!Array.isArray(listed)) {
      throw new AuthoringError(
        'state-key-list',
        `\`settings.${setting}\` is ${JSON.stringify(listed)}. Write the state keys ${does} as a list: \`${setting}: [${example.map(key => `'${key}'`).join(', ')}]\`.`
      );
    }

    return listed.map((key: unknown) => {
      if (typeof key !== 'string' || key.trim() === '') {
        throw new AuthoringError(
          'state-key-list',
          `\`settings.${setting}\` has ${JSON.stringify(key)}, which is not a state key. Each entry is the \`key\` a \`setState\` step writes, like 'demoStep'.`
        );
      }

      if (key.includes('.')) {
        throw new AuthoringError(
          'state-key-list',
          `\`settings.${setting}\` has "${key}", a dotted path. It names top-level keys of \`runtime.state\` — write "${key.split('.')[0]}" for everything under it.`
        );
      }

      return key;
    });
  }

  /**
   * The keys a space never keeps. Warned when it cannot DO anything: without `keepState` nothing is kept in the first
   * place.
   */
  private assertTransientState(): void {
    const transient = this.stateKeyList('transientState', ['demoStep', 'panelOpen'], 'never to keep');
    if (transient.length > 0 && this.spec.settings?.keepState !== true) {
      this.styleWarnings.push({
        code: 'transient-state-without-keep-state',
        message:
          '`settings.transientState` names keys never to keep, but `settings.keepState` is not on — nothing is kept in the first place, so it does nothing. Turn `keepState` on, or remove `transientState`.',
        details: { keys: transient }
      });
    }
  }

  /**
   * The kept keys the first paint depends on, which the server renders with (see `paintedState.ts` in sdk-shared).
   *
   * Refused when a key is also transient — never kept, and kept for the server, at once — since whichever the runtime
   * honoured the other would be silently wrong. Warned without `keepState`: nothing is kept, so there is nothing to
   * paint with.
   */
  private assertPaintedState(): void {
    const painted = this.stateKeyList('paintedState', ['toolPick', 'name'], 'the first paint shows');
    const transient = new Set(this.spec.settings?.transientState ?? []);
    const both = painted.filter(key => transient.has(key));
    if (both.length > 0) {
      throw new AuthoringError(
        'state-painted-and-transient',
        `\`settings.paintedState\` and \`settings.transientState\` both name ${both.map(key => `"${key}"`).join(', ')}. A painted key is kept, so the server can draw with it; a transient one never is. Remove ${both.length === 1 ? 'it' : 'them'} from one of the two.`
      );
    }

    if (painted.length > 0 && this.spec.settings?.keepState !== true) {
      this.styleWarnings.push({
        code: 'painted-state-without-keep-state',
        message:
          '`settings.paintedState` names kept keys for the server to draw with, but `settings.keepState` is not on — nothing is kept, so there is nothing to draw with. Turn `keepState` on, or remove `paintedState`.',
        details: { keys: painted }
      });
    }
  }

  /**
   * The visitors' roles and what each gives (`checkVisitorRoles`). Refused rather than repaired — a role written wrong
   * is a person who cannot do what they were given, or one who can do what they were not, and neither says so anywhere.
   */
  private assertVisitorRoles(): void {
    const roles: unknown = this.spec.settings?.visitorRoles;
    if (roles === undefined) {
      return;
    }

    const checked = checkVisitorRoles(roles);
    if (!checked.ok) {
      throw new AuthoringError('visitor-roles', checked.problem);
    }
  }

  /** The element about to be placed under `parentId`, and everything that one is nested in. */
  private ancestorsOf(parentId: string, flat: Schema['flat']): Set<string> {
    return Object.hasOwn(flat, parentId) ? new Set([parentId, ...parentChain(flat, parentId)]) : new Set();
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
        throw new AuthoringError(
          'folder-undeclared',
          `Page folder "${folder.id}" sits in "${folder.parent}", which this space does not declare${didYouMean(folder.parent, [...byId.keys()])}`
        );
      }
    }

    for (const folder of declared) {
      const seen = new Set<string>([folder.id]);
      let parent = folder.parent;
      while (parent !== undefined) {
        if (seen.has(parent)) {
          throw new AuthoringError('folder-cycle', `Page folder "${folder.id}" is inside itself, through "${parent}"`);
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
  /**
   * Where a visitor a page is not for is sent, written the way the router reads it: a page's id, or an address off
   * this space.
   *
   * An author reaches for the page's id, its slug, its path or `''` for the home page, and all of them are resolved
   * here — the router takes an empty value for "no redirect", so `unauthorizedRedirect: ''`, meaning "the sign-in,
   * which is the home page", used to be dropped without a word: a visitor signing out of a members page was left on
   * "Access Denied", with the flow that would have navigated away unmounted under it.
   */
  private writeRedirect(page: PageSpec, id: string): void {
    if (page.unauthorizedRedirect === undefined) {
      return;
    }

    const element = this.flatMap.flat[id];
    this.flatMap.updateElement({
      ...element,
      attributes: {
        ...element.attributes,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: this.redirectTarget(page.unauthorizedRedirect, `Page "${page.name}"`)
      }
    });
  }

  private redirectTarget(target: string, where: string): string {
    // Somewhere else — a whole URL, or one a template fills at run time (`{{authUrl}}/`) — is kept as written.
    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(target) || target.includes('{{')) {
      return target;
    }

    const pages = Object.values(this.handles);
    const path = pathForSlug(target.replace(/^\/+|\/+$/gu, ''));
    const page = pages.find(candidate => candidate.id === target) ?? pages.find(candidate => candidate.path === path);
    if (!page) {
      const names = pages.flatMap(candidate => [candidate.id, candidate.path]);
      throw new AuthoringError(
        'redirect-target-unknown',
        `${where} sends a visitor it is not for to "${target}", which is no page of this space${didYouMean(target, names)}. Write a page's id or slug (\`''\` is the home page), or a full URL for somewhere else.`
      );
    }

    return page.id;
  }

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
      throw new AuthoringError(
        'folder-undeclared',
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
        ...(page.flows ? { interactions: authorFlows(page.flows, id) } : {}),
        ...(page.flag === undefined ? {} : { flag: flagGateOf(page.flag, `Page "${page.name}"`) })
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
      ...(page.layout ? { layout: page.layout.id } : {}),
      elements: {}
    };

    page.body.forEach((child, childIndex) =>
      this.addElement(child, `${path}/${childIndex}`, placeOf(child, `Page "${page.name}"`, childIndex), id, id)
    );

    return id;
  }

  /**
   * A component: its tree written into a `flat` of its own, rooted at its root element, and its declaration held to
   * that tree — every slot one of its elements.
   */
  private addComponent(component: ComponentSpec): SpaceComponent {
    const where = `Component "${component.id}"`;
    const tree = this.componentTrees.get(component.id);
    if (!tree) {
      throw new Error(`${where} was not collected before it was written`);
    }

    const rootId = this.addElement(
      component.root,
      `${this.spec.permanentUrl}/component:${component.id}`,
      placeOf(component.root, `Component "${component.id}"`),
      '',
      '',
      false,
      tree
    );
    const ids = Object.keys(tree.map.flat);
    for (const slot of component.slots ?? []) {
      if (!ids.includes(slot)) {
        throw new AuthoringError(
          'slot-unknown',
          `${where} declares the slot "${slot}", which is not an element of its tree${didYouMean(slot, ids) || '.'} A slot is an element inside the component — usually an empty container — that an instance fills.`
        );
      }
    }

    return {
      id: component.id,
      ...(component.label ? { label: component.label } : {}),
      ...(component.folder ? { folder: component.folder } : {}),
      ...(component.props ? { props: component.props } : {}),
      ...(component.slots ? { slots: component.slots } : {}),
      rootId,
      flat: tree.map.flat
    };
  }

  /**
   * An instance against the component it places, before it is written: the component exists, every prop it hands in
   * is declared and of the declared kind, none it requires is missing, and every child fills a slot it has.
   */
  private assertInstance(spec: ElementSpec, where: string): void {
    const declared = this.spec.components ?? [];
    const componentId = spec.attributes?.referenceId;
    const target = declared.find(candidate => candidate.id === componentId);
    if (!target) {
      throw new AuthoringError(
        'component-undeclared',
        `${where} places component "${String(componentId)}", which this space does not declare${
          typeof componentId === 'string'
            ? didYouMean(
                componentId,
                declared.map(candidate => candidate.id)
              ) || '.'
            : '.'
        } Declare it in \`components\`.`
      );
    }

    const props = target.props ?? {};
    const names = Object.keys(props);
    const given = Object.fromEntries(
      // What the instance answers to as an element — which component it is, the slot it sits in — is not a prop.
      Object.entries(spec.attributes ?? {}).filter(([name]) => !RESERVED_PROP_NAMES.has(name))
    );
    for (const name of Object.keys(given)) {
      if (!names.includes(name)) {
        throw new AuthoringError(
          'prop-unknown',
          `${where} hands component "${target.id}" "${name}", which it does not declare${didYouMean(name, names) || '.'} It declares ${names.length > 0 ? names.join(', ') : 'no props'}.`
        );
      }
    }

    const bound = new Set(spec.bind === undefined ? [] : toBindingSpecs(spec.bind).map(binding => binding.to));
    for (const [name, prop] of Object.entries(props)) {
      if (prop.required && given[name] === undefined && !bound.has(name)) {
        throw new AuthoringError(
          'prop-missing',
          `${where} places component "${target.id}" without "${name}", which it requires${prop.description ? ` — ${prop.description}` : ''}. Hand it in: \`component('${target.id}', { props: { ${name}: … } })\`, or bind it.`
        );
      }
    }

    const invalid = invalidParams(given, given, props).at(0);
    if (invalid) {
      throw new AuthoringError(
        'prop-value',
        `${where} hands component "${target.id}" "${invalid.key}" as ${invalid.got}, and it is declared ${invalid.expected}${invalid.options ? ` — one of ${invalid.options.map(option => `'${option}'`).join(', ')}` : ''}.`
      );
    }

    const slots = target.slots ?? [];
    for (const child of spec.children ?? []) {
      const named = child.attributes?.slot;
      const slot = typeof named === 'string' ? named : slots.length === 1 ? slots[0] : undefined;
      if (slot === undefined || !slots.includes(slot)) {
        throw new AuthoringError(
          'slot-children',
          `${where} puts a "${child.type}" in ${slot === undefined ? 'no slot' : `the slot "${slot}"`}, but component "${target.id}" declares ${slots.length > 0 ? `the slots ${slots.map(name => `"${name}"`).join(', ')} — hand children in by slot: \`children: { '${slots[0]}': [ … ] }\`` : 'no slots, so an instance of it takes no children'}.`
        );
      }
    }
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
      throw new AuthoringError(
        'folder-undeclared',
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
        ...(bindings?.length ? { bindings: groupBindings(path, bindings, sourceIndex, where) } : {}),
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
      ...(layout.layout ? { layout: layout.layout.id } : {}),
      elements: {}
    };
    layout.body.forEach((child, index) =>
      this.addElement(child, `${path}/${index}`, placeOf(child, `Layout "${layout.id}"`, index), layout.id, layout.id)
    );
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
      throw new AuthoringError(
        'layout-undeclared',
        `${where} renders inside the layout "${layout.id}", which this space does not declare${didYouMean(layout.id, declared)}`
      );
    }

    const slot = this.flatMap.flat[layout.slot] as Element | undefined;
    if (!slot || slot.definition.rootId !== layout.id || slot.id === layout.id) {
      throw new AuthoringError(
        'layout-slot-unknown',
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

  private slotSelectors(spec: ElementSpec, place: string): Record<string, string> {
    return Object.fromEntries(
      Object.entries(spec.slots ?? {}).map(([slot, value]) => {
        const names = classNames(value);
        names.forEach(name => this.assertClass(name, `Slot "${slot}" of element "${spec.type}" at ${place}`));

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
  /**
   * An element whose every child shows only under a condition — four menu panels in one list, each opening on the
   * state that names it — shows nothing on a bare visit either, and that is it working: it is conditional the way its
   * children are. Bottom up, so a wrapper of such an element is too. Without it a suite asserting "everything named
   * is visible" failed on the menu at rest, and the only way past was a condition on the parent that said nothing new.
   */
  private markConditionalByChildren(schema: Schema): void {
    const handles = [...Object.values(this.handles), ...Object.values(this.layoutHandles)].flatMap(root =>
      Object.values(root.elements)
    );
    const byId = new Map(handles.map(handle => [handle.id, handle]));
    for (let changed = true; changed;) {
      changed = false;
      for (const handle of handles) {
        const items = handle.conditional ? [] : (schema.flat[handle.id].definition.items ?? []);
        if (items.length > 0 && items.every(child => byId.get(child)?.conditional === true)) {
          handle.conditional = true;
          changed = true;
        }
      }
    }
  }

  /** The name an element's plugin is declared under: its own type, or `custom:<renderType>` for one a `custom` hosts. */
  private pluginKeyOf(element: Element): string {
    const { type } = element.definition;
    const renderType = element.attributes.renderType;

    return type === CUSTOM_TYPE && typeof renderType === 'string' ? `${CUSTOM_TYPE}:${renderType}` : type;
  }

  /** Whether the element's plugin declares it draws nothing. */
  private drawsNothing(element: Element): boolean {
    return this.options.drawsNothingTypes?.includes(this.pluginKeyOf(element)) ?? false;
  }

  /** Plugin types already warned about a reserved attribute: said once, at the first element of the type. */
  private readonly reservedWarned = new Set<string>();

  /**
   * What an element is written with that reaches nothing, said: a variant no class and no type style declares — the
   * element looks the same with it or without — and, once per plugin, an attribute it declares under one of the
   * element's own names, which a factory reads as that and never hands to the plugin.
   */
  private warnUnreachable(element: Element, spec: ElementSpec, where: string): void {
    const key = this.pluginKeyOf(element);
    const reserved = this.options.reservedPluginAttributes?.[key] ?? [];
    if (reserved.length > 0 && !this.reservedWarned.has(key)) {
      this.reservedWarned.add(key);
      this.styleWarnings.push({
        code: 'plugin-attribute-reserved',
        message: `${where} is a "${key}", whose plugin declares ${reserved.map(name => `\`${name}\``).join(', ')} — ${reserved.length === 1 ? 'a name' : 'names'} authoring reads as the element's own (\`variant\` is its style variant, \`class\` its classes), so the plugin is never handed ${reserved.length === 1 ? 'it' : 'them'}. Rename ${reserved.length === 1 ? 'it' : 'them'} in the plugin: \`variant\` → \`kind\`.`,
        elementId: element.id
      });
    }

    if (spec.variant === undefined || this.variantDeclared(spec, spec.variant)) {
      return;
    }

    const plugin = reserved.includes('variant')
      ? ' If it was meant for the plugin’s own `variant`, that attribute is never set: rename it in the plugin.'
      : element.definition.type === CUSTOM_TYPE
        ? ' On a `custom` element `variant` is its style variant, never a prop of the component it hosts: hand the component a prop of another name (`tone`).'
        : '';
    this.styleWarnings.push({
      code: 'unknown-variant',
      message: `${where} is written with \`variant: '${spec.variant}'\`, which no class of it and no style of its type declares, so nothing applies.${plugin} Declare it — \`styles(name, { variants: { ${spec.variant}: { … } } })\` — or name one that is.`,
      elementId: element.id
    });
  }

  /** Whether `variant` is declared by the element's type style or by one of its classes — where `variantOwner` looks. */
  private variantDeclared(spec: ElementSpec, variant: string): boolean {
    if (this.spec.elements?.[spec.type]?.variants?.[variant] !== undefined) {
      return true;
    }

    return (
      spec.class !== undefined &&
      classNames(splitClassList(spec.class).refs).some(name =>
        Object.values(this.classRules.get(name) ?? {}).some(block => block.variants?.[variant] !== undefined)
      )
    );
  }

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

  /**
   * An element and everything under it, into `tree` — or, when it cannot be written, the reason kept for the end, so a
   * run reports every element that is wrong rather than the first. Its subtree is skipped; its siblings are not.
   */
  private addElement(
    spec: ElementSpec,
    path: string,
    place: string,
    rootId: string,
    parentId: string,
    insideCondition = false,
    tree = this.pagesTree
  ): string {
    try {
      return this.writeElement(spec, path, place, rootId, parentId, insideCondition, tree);
    } catch (error) {
      this.skipped += 1;
      this.refusals.push({ place, at: writtenAt(spec), ...refusalOf(error) });

      return typeof spec.id === 'string' ? spec.id : '';
    }
  }

  /**
   * The element's bindings with `from` among them: its main attribute bound to the source, through a template when `as`
   * names one — a format of the space's, or a template of its own. The same binding `bind` writes, said shorter.
   */
  private boundFrom(spec: ElementSpec, where: string): BindingsSpec | undefined {
    if (spec.from === undefined) {
      if (spec.as !== undefined) {
        throw new AuthoringError(
          'as-without-from',
          `${where} says \`as: '${spec.as}'\` with no \`from\`: \`as\` is how the source \`from\` names is shown.`
        );
      }

      return spec.bind;
    }

    const main = Object.hasOwn(MAIN_ATTRIBUTES, spec.type) ? MAIN_ATTRIBUTES[spec.type] : undefined;
    if (!main) {
      throw new AuthoringError(
        'from-without-attribute',
        `${where} has \`from\`, but a "${spec.type}" has no one attribute that shows its data. Bind the attribute you mean: \`bind: { attribute: '${spec.from}' }\`.`
      );
    }

    const bound = spec.bind === undefined ? [] : toBindingSpecs(spec.bind);
    if (bound.some(binding => binding.to === main && (binding.category ?? 'attributes') === 'attributes')) {
      throw new AuthoringError(
        'from-and-bind',
        `${where} binds "${main}" twice — with \`from\` and in \`bind\`. Keep \`from\`, and give \`bind\` the other attributes.`
      );
    }

    const template = spec.as === undefined ? undefined : this.templateFor(spec.as, where);

    return [
      ...bound,
      template === undefined
        ? { to: main, source: spec.from }
        : bindTemplate(main, spec.from, template, main === 'items' ? { returns: 'value' } : {})
    ];
  }

  /** A format by its name in the space's `formats`, or the template written in its place. */
  private templateFor(as: string, where: string): string {
    if (hasTemplateSyntax(as)) {
      return as;
    }

    const formats = this.spec.formats ?? {};
    if (!Object.hasOwn(formats, as) || typeof formats[as] !== 'string') {
      throw new AuthoringError(
        'format-unknown',
        `${where} shows its data \`as: '${as}'\`, which the space's \`formats\` do not name${didYouMean(as, Object.keys(formats)) || '.'} Declare it once — \`formats: { ${as}: "{{ source|currency('USD') }}" }\` — or write the template in its place.`
      );
    }

    return formats[as];
  }

  /**
   * `path` is the element's identity — what a selector of its own is named after, so it never changes; `place` is
   * how a person finds it: the nearest named element, and the steps from there.
   */
  private writeElement(
    spec: ElementSpec,
    path: string,
    place: string,
    rootId: string,
    parentId: string,
    insideCondition: boolean,
    tree: AuthorTree
  ): string {
    this.assertElementShape(spec, place);
    const id = spec.id ?? this.nextId(spec.type);
    this.specs.set(id, spec);
    const where = `Element "${spec.type}" (${id}) at ${place}`;
    this.assertFlowShapes(spec.flows, where);
    if (spec.type === 'reference' && spec.attributes?.referenceType === 'component') {
      this.assertInstance(spec, where);
    }

    if (spec.quiet !== undefined) {
      this.assertQuiet(spec.quiet, where);
    }

    const isRoot = parentId === '';
    const ownRootId = isRoot ? id : rootId;
    const bindings = withVisibility({ bind: this.boundFrom(spec, where), visible: spec.visible });
    const conditional = insideCondition || spec.visible !== undefined || hasVisibilityBinding(bindings);
    const ancestors = this.ancestorsOf(parentId, tree.map.flat);
    bindings?.forEach(binding => assertBindingShape(binding, where));
    const sourceIndex = this.options.sourceTypes ? tree.sources : undefined;

    const element: Element = {
      id,
      attributes: spec.attributes ?? {},
      definition: {
        label: spec.meta?.label ?? spec.type,
        type: spec.type,
        rootId: ownRootId,
        ...(isRoot ? {} : { parentId }),
        items: [],
        // A slot names a class outright: it dresses a part of an element that already exists, and a selector of
        // its own per control would write the same rule once per input on the page.
        styleSelectors: {
          base: this.selectorFor(path, spec, place),
          ...this.declaredSlots(spec.type),
          ...this.slotSelectors(spec, place)
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
        ...(spec.anchor === undefined ? {} : { anchor: spec.anchor }),
        ...(spec.motion === undefined ? {} : { motion: spec.motion }),
        // In the document, not only here: the builder and the MCP are offered the suggestions `suggestSpace` makes
        // from the document, and leave out the same ones.
        ...(spec.quiet === undefined ? {} : { quiet: [...spec.quiet] }),
        ...(spec.flag === undefined ? {} : { flag: flagGateOf(spec.flag, where) }),
        ...(bindings?.length ? { bindings: groupBindings(path, bindings, sourceIndex, where, tree.globals) } : {}),
        ...(spec.flows ? { interactions: authorFlows(spec.flows, id) } : {})
      }
    };

    this.insert(element, parentId, isRoot ? 'custom' : 'inside', place, tree);
    this.warnUnreachable(element, spec, where);

    this.recordHandle({
      id,
      type: spec.type,
      pageId: rootId,
      selector:
        element.definition.type === 'reference' && element.attributes.referenceType === 'component'
          ? instanceSelectorFor(id)
          : selectorFor(id),
      named: spec.id !== undefined,
      ...(conditional ? { conditional: true } : {}),
      ...([...ancestors].some(ancestor => REPEATING_TYPES.has(tree.map.flat[ancestor].definition.type))
        ? { repeated: true }
        : {}),
      ...(rendersNoTag(element) || this.drawsNothing(element) ? { boxless: true } : {})
    });

    const children = spec.row === undefined ? spec.children : this.rowChildren(spec, spec.row, id, where);
    children?.forEach((child, index) =>
      this.addElement(child, `${path}/${index}`, placeOf(child, place, index), ownRootId, id, conditional, tree)
    );

    return id;
  }

  /** A `row` placed: a list's IS its children; a carousel's goes in a track, beside the controls it was given. */
  private rowChildren(spec: ElementSpec, row: string, id: string, where: string): ElementSpec[] {
    const instance = this.rowInstance(row, id, where);
    if (spec.type !== 'carousel') {
      return [instance];
    }

    return [
      { type: 'carouselTrack', attributes: {}, children: [instance], meta: { label: 'Carousel Track' } },
      ...(spec.children ?? [])
    ];
  }

  /**
   * A list's `row` that names a component: that component, once per item, with the row bound to the prop that takes
   * it — `item`, or the component's only prop. The instance `component()` writes, written here because only the space
   * knows the component's props.
   */
  private rowInstance(componentId: string, listId: string, where: string): ElementSpec {
    const target = this.spec.components?.find(candidate => candidate.id === componentId);
    const props = Object.keys(target?.props ?? {});
    const prop = props.includes('item') ? 'item' : props.length === 1 ? props[0] : undefined;
    if (!target || !prop) {
      throw new AuthoringError(
        'row-component',
        target
          ? `${where} places component "${componentId}" per row, which has ${props.length === 0 ? 'no props' : `the props ${props.join(', ')} and none called "item"`} to take the row. Give it an \`item\` prop, or write the row as a function.`
          : `${where} places component "${componentId}" per row, which this space does not declare${
              didYouMean(
                componentId,
                (this.spec.components ?? []).map(candidate => candidate.id)
              ) || '.'
            }`
      );
    }

    return {
      type: 'reference',
      attributes: { referenceType: 'component', referenceId: componentId },
      bind: [{ to: prop, source: `${listId}.item` }],
      meta: { label: 'Reference' }
    };
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

/**
 * A fix's change as an edit of the source that wrote the element: the same change, on the props of the call that wrote
 * it — or on one of its steps, by the flow it is in and its place there.
 */
export interface SpecEdit extends Omit<FixChange, 'on'> {
  /** `children`: the children it holds — only its words and an icon — written as its own `content` and `icon`. */
  on: 'attribute' | 'field' | 'binding' | 'step' | 'children';
  /** For a step: which of the element's `flows`, and which step in it. */
  step?: { flow: number; index: number };
  /** For `children`: the icon's class, when one of them is an icon. */
  icon?: string;
  /** For `children`: where the icon goes, when it came after the words. */
  iconPlacement?: 'after';
}

/** One fix `fixSpace` would make, with where it was written and the edit that makes it there. */
export interface PlannedFix {
  code: string;
  message: string;
  elementId: string | null;
  /** Where the element was written: `src/space/pages/home.ts:42`. Absent for an element no factory wrote. */
  at?: string;
  /** The same place exactly — the factory's name, at its line and column — which is what the edit is made at. */
  position?: WrittenPosition;
  /** Absent when the fix has no one way to be written in the source — it is said, and left to the author. */
  edit?: SpecEdit;
}

const specEditOf = (change: FixChange, spec: ElementSpec): SpecEdit | undefined => {
  if (typeof change.on === 'string') {
    return { ...change, on: change.on };
  }

  const { step } = change.on;
  const flows = flowStepIds(spec.flows ?? []);
  for (const [flow, ids] of flows.entries()) {
    const index = ids.indexOf(step);
    if (index !== -1) {
      return { ...change, on: 'step', step: { flow, index } };
    }
  }

  // A step on the element that its own `flows` did not write — nothing in its source to edit.
  return undefined;
};

/** A problem the linter reports, by its code and the element it is on. */
export interface PlanProblem {
  code: string;
  elementId: string | null;
  message: string;
}

/** What is wrong with a declaration, and what of it has one fix. */
export interface FixPlan {
  /** Every problem the linter reports — errors and warnings alike, whether or not the space would be refused. */
  problems: PlanProblem[];
  fixes: PlannedFix[];
}

/**
 * What `fixSpace` would settle in this declaration, each with the place in the author's own code that wrote it and
 * the edit that makes the same fix there — what `plitzi fix` shows, and writes when asked — beside every problem the
 * linter reports, which a written fix must not add to. The documents are written as `authorSpace` writes them,
 * without its gate: the problems a fix settles are the ones the gate stops on.
 */
export const planFixes = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): FixPlan => {
  const author = new SpaceAuthor(spec, options);
  const documents = author.write();
  const lint = lintSpace(documents, options);
  const problems = [...lint.errors, ...lint.warnings].map(issue => ({
    code: issue.code,
    elementId: issue.elementId ?? null,
    message: issue.message
  }));

  const fixes: PlannedFix[] = fixSpace(documents, options).applied.map(fix => {
    const written = fix.elementId === null ? undefined : author.specOf(fix.elementId);
    const at = written ? writtenAt(written) : undefined;
    const position = written ? writtenAtPosition(written) : undefined;
    const edit = written && fix.change ? specEditOf(fix.change, written) : undefined;

    return {
      code: fix.code,
      message: fix.message,
      elementId: fix.elementId,
      ...(at === undefined ? {} : { at }),
      ...(position === undefined ? {} : { position }),
      ...(edit === undefined ? {} : { edit })
    };
  });

  return { problems, fixes: [...fixes, ...contentFixes(author, documents)] };
};

/**
 * The `content-attribute` suggestions that have one way to be written: the children only words and an icon, none of
 * them named — a child with an id of its own is something a test or a flow may point at — and the words wearing no
 * class whose rules would have to be moved by hand.
 */
const contentFixes = (author: SpaceAuthor, documents: { schema: Schema; style: Style }): PlannedFix[] =>
  contentMoves(documents.schema, documents.style)
    .filter(move => !move.classed && move.children.every(child => author.specOf(child)?.id === undefined))
    .map(move => {
      const written = author.specOf(move.id);
      const at = written ? writtenAt(written) : undefined;
      const position = written ? writtenAtPosition(written) : undefined;
      const holds = move.icon === undefined ? 'its words' : move.words ? 'its words and an icon' : 'an icon';

      return {
        code: 'content-attribute',
        message: `"${move.id}" holds only ${holds} as elements: they are its own \`content\`${move.icon === undefined ? '' : ' and `icon`'}.`,
        elementId: move.id,
        ...(at === undefined ? {} : { at }),
        ...(position === undefined ? {} : { position }),
        edit: {
          on: 'children',
          op: 'set',
          key: 'content',
          value: move.words,
          ...(move.icon === undefined ? {} : { icon: move.icon }),
          ...(move.iconAfter ? { iconPlacement: 'after' } : {})
        }
      };
    });
