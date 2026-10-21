import { FlatMap } from '@plitzi/sdk-schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';
import { generateCache } from '@plitzi/sdk-style';

import { BREAKPOINTS, isStyleDeclaration, toBlocks } from '../../style';
import { suggestClassOverrides, suggestSpace, withoutQuieted } from '../advice';
import { COMPONENT_SOURCES, GLOBAL_SOURCES, scopedHint } from '../bindings';
import { AuthoringError } from '../codes';
import { buildHandles } from '../handles';
import { withKeyframesCss } from '../keyframes';
import { withNotificationsCss } from '../notifications';
import { familyOf } from '../pageFamily';
import { refusalOf, SpaceRefusedError } from '../refusals';
import { didYouMean } from '../suggest';
import { assertSpaceValid, validateSpace } from '../validate';
import { writtenAt } from '../writtenAt';
import {
  assertChannels,
  assertComputedOnce,
  assertRobotsTxt,
  assertPaintedState,
  assertSpaceShape,
  assertTransientState,
  assertVisitorRoles,
  collectSources
} from './checks';
import { markConditionalByChildren, resolveControls } from './elements';
import { addComponent, addLayout, addPage, assertLayoutRef, buildPageFolders, writeRedirect } from './pages';
import {
  assertAncestorClasses,
  collectDeclarations,
  declareClass,
  parseFonts,
  writeElementDefaults,
  writeSelector
} from './styles';
import { declaredAt } from './values';

import type { ResponsiveBlock, StyleDeclaration } from '../../style';
import type { Suggestion, WornClass, WornList } from '../advice';
import type { SourceIndex } from '../bindings';
import type { WarningCode } from '../codes';
import type { LayoutHandle, PageHandle } from '../handles';
import type { SpaceRefusal } from '../refusals';
import type { AuthorSpaceOptions, AuthoredSpace, ElementSpec, SpaceSpec } from '../types';
import type { AuthorTree } from './values';
import type { SchemaValidationError } from '@plitzi/sdk-schema';
import type { Schema, Style, StyleMode } from '@plitzi/sdk-shared';

/**
 * One writing of a spec: what it has written so far, read and added to by the functions of this folder — each takes
 * the author. Never handed out: `authorSpace`, `planFixes` and the locators answer with what it wrote.
 */
export class SpaceAuthor {
  readonly flatMap = new FlatMap({ flat: {}, variables: [] });

  readonly platform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };

  readonly idCounters = new Map<string, number>();

  /** Every name the AUTHOR wrote, collected before the tree is built so a derived `<type>-<n>` never lands on one. */
  readonly authorNames = new Set<string>();

  readonly pagePaths = new Set<string>();

  /** Where each id was written, so a second element answering to it can say where the first one is. */
  readonly authoredAt = new Map<string, string>();

  /** The spec each element was written from, by the id it got: where a fix to its document is a fix to its source. */
  readonly specs = new Map<string, ElementSpec>();

  /** The pages each `pageFamily` wrote, by id: one body, written once, however many pages carry it. */
  families: string[][] = [];

  /** Each folder's route prefix, resolved through its parents. Filled before any page is written. */
  readonly folderPrefixes = new Map<string, string>();

  /**
   * What a test will address this space by, collected as the tree is written rather than walked again afterwards.
   *
   * Here and not in a second pass because this is the only place that knows an element's FINAL id: a spec may leave
   * it out, and the derived `<type>-<n>` exists nowhere until it is minted below.
   */
  readonly handles: Record<string, PageHandle> = {};

  readonly layoutHandles: Record<string, LayoutHandle> = {};

  /** Every class this space declares, whether from `classes` or from a `styles()` declaration found in the tree. */
  readonly classRules = new Map<string, ResponsiveBlock>();

  /** Where each class was first declared, in words — what a second declaration that disagrees is told it disagrees with. */
  readonly classOrigins = new Map<string, () => string>();

  /** Where each class's rules were written, in words — what `class-overrides-class` names it by. */
  readonly classWritten = new Map<string, () => string>();

  /** Each class written with `styles()`, by name: the declaration, which knows the line of the author's that wrote it. */
  readonly classDeclarations = new Map<string, StyleDeclaration>();

  /** Each element's own rules on top of its classes (`<id>--own`), and where they were written. */
  readonly ownRules = new Map<string, { blocks: ResponsiveBlock; written: () => string }>();

  /** Every element's own selector, named or derived — each one is that element's alone. */
  readonly ownSelectors = new Set<string>();

  /** Every element in this space that publishes a data source, by id, and the name it publishes it under. */
  readonly sources: SourceIndex = new Map();

  /** The pages' tree — layouts included — which is where everything not inside a component is written. */
  readonly pagesTree: AuthorTree = { map: this.flatMap, sources: this.sources, globals: GLOBAL_SOURCES };

  /** Each component's tree, by component id. */
  readonly componentTrees = new Map<string, AuthorTree>();

  /** Rules that render, and render differently from what they plainly mean — see `warnTabletOnly`. */
  readonly styleWarnings: (SchemaValidationError & { code: WarningCode })[] = [];

  /** What could not be written as declared, kept so the run reports all of it (see `addElement`). */
  readonly refusals: SpaceRefusal[] = [];

  /** Elements left out of the documents for a refusal — while any is, the documents are not whole enough to lint. */
  skipped = 0;

  constructor(
    readonly spec: SpaceSpec,
    readonly options: AuthorSpaceOptions = {}
  ) {}

  author(): AuthoredSpace {
    const { schema, style } = this.write();

    // The gate, and the same one anybody else's documents go through. An authored space that cannot pass it is a
    // bug in the declaration, and finding out at seed time beats finding out at render time.
    //
    // `FlatMap.assertValid` is deliberately not also called here: it validates the flat map with no pages
    // attached, which is a strictly weaker reading of the same document than the pair below.
    // Each said where the element it is about was written, and — a name pointed at that nothing answers to — with
    // the nearest one there is: the line to go to and the fix, not a search through the source.
    const allow = this.options.allow ?? [];
    const answering = this.options.vocabulary?.callbacks;
    // The names a missing one could have meant: of the elements that answer the step it was for, when that is known —
    // the nearest name of any type is how a renamed modal was offered a search field.
    const meant = (missing: string, step: string | undefined): string => {
      const elements = Object.values(schema.flat);
      const fit =
        step && answering
          ? elements
              .filter(
                element =>
                  Object.hasOwn(answering, element.definition.type) && answering[element.definition.type].includes(step)
              )
              .map(element => element.id)
          : elements.map(element => element.id);
      const nearest = didYouMean(missing, fit);
      if (nearest || !step || !answering) {
        return nearest;
      }

      return fit.length === 0
        ? ` — no element of the space answers \`${step}\``
        : fit.length <= 5
          ? ` — the elements that answer \`${step}\`: ${fit.join(', ')}`
          : '';
    };
    const gate = validateSpace({ schema, style }, this.options)
      .errors.filter(error => !allow.some(entry => entry.code === error.code && entry.element === error.elementId))
      .map(error => {
        const written = error.elementId ? this.specOf(error.elementId) : undefined;
        const at = written ? writtenAt(written) : undefined;

        return {
          place: error.elementId ? `"${error.elementId}"` : '',
          code: error.code,
          message: `${error.message}${error.missing ? meant(error.missing, error.wantedBy) : ''}${
            error.code === 'UNRESOLVED_BINDING_SOURCE' && error.missing
              ? scopedHint(error.missing, Object.keys(schema.flat))
              : ''
          }`,
          ...(at === undefined ? {} : { at })
        };
      });
    if (this.refusals.length > 0 || gate.length > 0) {
      throw new SpaceRefusedError(this.spec.permanentUrl, [...this.refusals, ...gate]);
    }

    const warnings = assertSpaceValid(
      { schema, style },
      `authored space "${this.spec.permanentUrl}"`,
      this.options,
      this.options.allow
    );

    // Where each suggestion's first element was written, as a refusal says it: the line to go and change.
    const suggestions = [
      ...suggestSpace(
        { schema, style },
        {
          stylesheets: this.options.stylesheets ?? [],
          families: this.families,
          pluginTypes: this.options.pluginTypes ?? []
        }
      ),
      ...withoutQuieted(schema, classOverrides(this, schema, style.mode ?? 'desktop-first'))
    ].map(suggestion => {
      const first = suggestion.elementIds.at(0);
      const at = first === undefined ? undefined : writtenAt(this.specOf(first));

      return at === undefined ? suggestion : { ...suggestion, at };
    });

    markConditionalByChildren(this, schema);

    return {
      schema,
      style,
      handles: buildHandles(this.handles, this.layoutHandles),
      warnings: [...this.styleWarnings, ...warnings],
      suggestions
    };
  }

  /** The spec an element was written from, by its id in the documents. */
  /** Every class the space declares, by name, with the `styles()` declaration that wrote it when one did. */
  declaredClasses(): [string, StyleDeclaration | undefined][] {
    return [...this.classRules.keys()].map(name => [name, this.classDeclarations.get(name)]);
  }

  specOf(id: string): ElementSpec | undefined {
    return this.specs.get(id);
  }

  /**
   * The documents as the declaration writes them, before the gate every space goes through: what a fix is planned
   * on, since the problems a fix settles are exactly the ones that gate reports. Throws only what kept them from being
   * written at all.
   */
  write(): { schema: Schema; style: Style } {
    assertSpaceShape(this);
    for (const [type, elementSpec] of Object.entries(this.spec.elements ?? {})) {
      writeElementDefaults(this, type, elementSpec);
    }

    for (const [name, value] of Object.entries(this.spec.classes ?? {})) {
      if (!isStyleDeclaration(value)) {
        declareClass(
          this,
          name,
          toBlocks(value),
          () => `the space-wide \`classes\` entry "${name}"`,
          () => `the space-wide \`classes\` entry "${name}"`
        );
        continue;
      }

      if (value.name !== name) {
        throw new AuthoringError(
          'class-listed-under-other-name',
          `The space-wide \`classes\` lists the declaration "${value.name}" under the name "${name}". A declaration is listed under its own name.`
        );
      }

      declareClass(
        this,
        name,
        value.rules,
        () => `${declaredAt(value)}, listed in the space-wide \`classes\``,
        () => declaredAt(value),
        value
      );
    }

    const layouts = this.spec.layouts ?? [];
    const components = this.spec.components ?? [];

    // Before the tree is written, so the stylesheet is whole by the time anything names a class and a name that
    // means two different things is refused at the declaration rather than at whichever use happened to be second.
    components.forEach(component =>
      collectDeclarations(this, undefined, [component.root], `component "${component.id}"`)
    );
    layouts.forEach(layout => collectDeclarations(this, layout.class, layout.body, `layout "${layout.id}"`));
    this.spec.pages.forEach(page => collectDeclarations(this, page.class, page.body, `page "${page.name}"`));

    // Same reason, for the other thing an element names by a name declared elsewhere: a binding may read a
    // provider written further down the page than the element reading it. The author's own names are collected in
    // the same pass, so a derived `<type>-<n>` never claims a name written further down.
    components.forEach(component => {
      const sources: SourceIndex = new Map();
      collectSources(this, component.root, sources);
      this.componentTrees.set(component.id, {
        map: new FlatMap({ flat: {}, variables: [] }),
        sources,
        globals: COMPONENT_SOURCES
      });
    });
    layouts.forEach(layout => {
      this.authorNames.add(layout.id);
      layout.body.forEach(child => collectSources(this, child));
    });
    this.spec.pages.forEach(page => {
      if (page.id) {
        this.authorNames.add(page.id);
      }

      page.body.forEach(child => collectSources(this, child));
    });

    for (const [name, responsive] of this.classRules) {
      // A class declared with no rules is still a class the space has — a hook for a stylesheet, a name its elements
      // wear — so it is written, empty. Left out, the document stops saying it exists, and reading it back drops the
      // name from every element wearing it.
      const blocks = BREAKPOINTS.some(breakpoint => responsive[breakpoint]) ? responsive : { desktop: {} };
      writeSelector(this, name, blocks, `Class "${name}"`);
    }

    assertAncestorClasses(this);

    assertComputedOnce(this);
    assertRobotsTxt(this);
    assertChannels(this);
    assertTransientState(this);
    assertPaintedState(this);
    assertVisitorRoles(this);
    const pageFolders = buildPageFolders(this);
    const declared = collecting(this, () => components.map(component => addComponent(this, component)));
    collecting(this, () => layouts.forEach(layout => addLayout(this, layout)));
    const pages = collecting(this, () => this.spec.pages.map((page, index) => addPage(this, page, index)));
    const families = new Map<object, string[]>();
    this.spec.pages.forEach((page, index) => {
      const family = familyOf(page);
      if (family !== undefined) {
        families.set(family, [...(families.get(family) ?? []), pages[index]]);
      }
    });
    this.families = [...families.values()];
    if (this.skipped > 0) {
      throw new SpaceRefusedError(this.spec.permanentUrl, this.refusals, { linted: false });
    }

    // After every root is written, because a slot is an element INSIDE a layout and a layout may be named by one
    // declared further down.
    layouts.forEach(layout => assertLayoutRef(this, layout.layout, `Layout "${layout.id}"`));
    this.spec.pages.forEach(page => assertLayoutRef(this, page.layout, `Page "${page.name}"`));
    // After every page is written, too: a redirect names a page that may be declared further down, by an id authoring
    // derives when it is.
    this.spec.pages.forEach((page, index) => writeRedirect(this, page, pages[index]));
    // After every element is written: a button may control one declared further down.
    resolveControls(this);
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
      ...(this.spec.fonts ? { fonts: parseFonts(this, this.spec.fonts) } : {}),
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
        // The keyframes at the top and the notifications' rules at the end: where the style editor reads each back.
        customCss: withKeyframesCss(
          withNotificationsCss(this.spec.customCss ?? '', this.spec.notifications),
          this.spec.keyframes
        ),
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

  /** Plugin types already warned about a reserved attribute: said once, at the first element of the type. */
  readonly reservedWarned = new Set<string>();
}

/**
 * Every node wearing more than one class — the classes and an element's own rules on top of them — read for a class
 * whose shorthand erases another's longhand (`suggestClassOverrides`), with the shorthands only authoring still knows.
 */
const classOverrides = (author: SpaceAuthor, schema: Schema, mode: StyleMode): Suggestion[] => {
  const order = new Map([...author.classRules.keys()].map((name, index) => [name, index]));
  const worn = (name: string): WornClass[] => {
    const blocks = author.classRules.get(name);
    const written = author.classWritten.get(name);
    if (blocks && written) {
      return [{ name, blocks, order: order.get(name) ?? 0, written }];
    }

    // An element's own rules are written after every class, so they come last in each breakpoint's rules.
    const own = author.ownRules.get(name);

    return own ? [{ name, blocks: own.blocks, order: order.size, written: own.written }] : [];
  };
  const lists: WornList[] = [schema.flat, ...Object.values(schema.components).map(component => component.flat)]
    .flatMap(flat => Object.values(flat))
    .flatMap(element =>
      Object.values(element.definition.styleSelectors).flatMap(selector => {
        const classes = [...new Set(selector.split(' ').filter(Boolean))].flatMap(worn);

        return classes.length > 1 ? [{ elementId: element.id, classes }] : [];
      })
    );

  return suggestClassOverrides(lists, mode);
};

/**
 * Runs a writing phase. A problem it throws once elements have already been refused is one more refusal — most often
 * a consequence of them — reported with the rest rather than instead of them.
 */
const collecting = <T>(author: SpaceAuthor, write: () => T): T => {
  try {
    return write();
  } catch (error) {
    if (author.refusals.length === 0) {
      throw error;
    }

    author.refusals.push({ place: '', ...refusalOf(error) });
    throw new SpaceRefusedError(author.spec.permanentUrl, author.refusals, { linted: false });
  }
};

/**
 * Build a space's two documents from a declaration. Throws if the result would not be a valid space.
 *
 * `options.vocabulary` is what lets it check the flows as well as the tree. `@plitzi/sdk-authoring` — the package
 * that composes this one with the elements and the interactions — supplies the real one, so importing from there is
 * all it takes.
 */
export const authorSpace = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): AuthoredSpace =>
  new SpaceAuthor(spec, options).author();
