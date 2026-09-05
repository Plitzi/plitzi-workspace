import type { SpaceHandles } from './handles';
import type { CssProps, CssSpec, StyleDeclaration } from '../style';
import type { SchemaValidationError } from '@plitzi/sdk-schema/helpers/schemaValidator';
import type {
  BindingCategory,
  ElementBinding,
  ElementInteraction,
  ElementRuntime,
  Schema,
  SchemaVariable,
  Style,
  StyleVariables,
  Template
} from '@plitzi/sdk-shared';

/**
 * What an author declares, as opposed to what a document stores.
 *
 * A space is two documents of deeply cross-referenced ids: every element carries its own id, its parent's, its
 * root's and the name of a style selector that has to exist in three breakpoint maps, and an interaction is a
 * linked list threaded through `beforeNode`/`afterNode`. None of that is a decision — it is bookkeeping, and it is
 * derived. What is left here is what a person actually chooses: a tree, some CSS, what happens on click.
 */

/** A step in an interaction flow. The chaining, ids and flow id are derived; this is what the author decides. */
export interface StepSpec {
  /**
   * What later steps call this one by.
   *
   * A flow's scope is keyed by node id, so `{{ publish.output.url }}` resolves only when the step that produced it
   * is named `publish`. Left out, the id is derived from the step's position — unique, and nothing an author can
   * write down, which is the same as saying a step's result is unreachable.
   */
  id?: string;
  type: ElementInteraction['type'];
  action: string;
  title?: string;
  params?: Record<string, unknown>;
  preview?: Record<string, unknown>;
  /** The id of the element the step is registered on. Utilities are resolved by action alone and take none. */
  on?: string;
  when?: ElementInteraction['when'];
  enabled?: boolean;
}

export interface BindingSpec {
  /** Attribute, style property or state key that receives the value. */
  to: string;
  /**
   * Where the value comes from.
   *
   * Normally `<id>.<field>` — the name YOU gave the element, and the source prefix is looked up from what that
   * element publishes. The four globals (`variables`, `navigation`, `auth`, `state`) are named as themselves, and
   * a source written in full (`apiContainer_posts.data`) is left alone but checked.
   */
  source: string;
  category?: BindingCategory;
  transformers?: ElementBinding['transformers'];
  when?: ElementBinding['when'];
  enabled?: boolean;
}

/**
 * Bindings, in either of the two forms.
 *
 * The map is the common case and the short one — `{ content: 'apiContainer_posts.title' }` — and it targets
 * attributes, which is what nearly every binding does. The array is for everything else: a binding onto element
 * state, one with a transformer, one that only applies under a condition.
 */
export type BindingsSpec = Record<string, string> | BindingSpec[];

/** Fields the builder shows but the runtime does not read. */
export interface SpecMeta {
  /**
   * The name this element answers to in the builder's tree.
   *
   * Not `label` at the top level, and not by accident: `label` is a real attribute of a link and of a form control,
   * and an authoring field of the same name would quietly shadow it — the field an author obviously means when
   * they write `label` on a form control is the one the user reads.
   */
  label?: string;
}

export interface ElementSpec {
  type: string;
  /**
   * The one name this element answers to, everywhere: its key in the document, a binding's source
   * (`apiContainer_posts.records`), a step's `on`, an interaction target.
   *
   * Derived as `<type>-<n>` when left out, which is unique but POSITIONAL — adding an element above renumbers
   * every one below it, and each binding that named one then points at a different element without changing.
   * Name the ones something else refers to; a derived name is deliberately not accepted as a binding source.
   */
  id?: string;
  attributes?: Record<string, unknown>;
  /** Style variant of the element's own vocabulary, e.g. a heading's `title`. */
  variant?: string;
  /**
   * A rule set of this element's own. Shorthands are expanded and every property is checked before it is written,
   * so what reaches the document is what the style editor can read back.
   */
  css?: CssSpec;
  /**
   * Reuse a selector authored elsewhere in the space instead of minting one. Two elements naming the same class
   * share one rule, which is the difference between a stylesheet and a pile of one-off declarations.
   *
   * Exclusive with {@link ElementSpec.css}: an element has exactly one base selector, so declaring both is a
   * question with no answer and is refused rather than silently resolved.
   *
   * Either a name from {@link SpaceSpec.classes}, or a {@link StyleDeclaration} from `styles()` that brings its own
   * rules along.
   */
  class?: string | StyleDeclaration;
  /**
   * A class for one of the element's OTHER style selectors, by selector name — a form control's `input`, `label`
   * and `error`.
   *
   * `css` and `class` above are its `base`, and an element made of parts cannot be dressed through that one alone:
   * a rule meant for the input lands on the wrapper instead, and the input keeps the browser's own look. The value
   * names a class from {@link SpaceSpec.classes} — or carries one, as a {@link StyleDeclaration} — so one rule
   * serves every control that wants it.
   */
  slots?: Record<string, string | StyleDeclaration>;
  bind?: BindingsSpec;
  /**
   * Show this element only while the value at this source is true. `!source` shows it while the value is false.
   *
   * Visibility is element STATE rather than an attribute, which is the one binding nobody guesses the category of
   * — and getting it wrong writes a `visibility` attribute no element reads, so the element stays visible and
   * nothing reports anything. As a field it cannot be got wrong, and it leaves {@link ElementSpec.bind} free to
   * stay in its short form: a condition is not an attribute, and pushing one into the list turned every binding
   * beside it into the long one.
   *
   * One field with a `!` rather than a `visible`/`hidden` pair, because `hidden` is a real HTML attribute — and in
   * this surface the attribute keeps a name it shares with anything else.
   */
  visible?: string;
  /** One flow per entry. Steps are chained in order. */
  flows?: StepSpec[][];
  runtime?: ElementRuntime;
  children?: ElementSpec[];
  meta?: SpecMeta;
}

export interface PageSpec {
  name: string;
  /** As {@link ElementSpec.id} — a page is an element, and its flows are targeted the same way. */
  id?: string;
  /** Route, without a leading slash. Empty is the home page. */
  slug: string;
  isDefault?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  /**
   * Who this page is FOR, and the trap is that omitting it is not the same as `public`.
   *
   * A page with no `accessLevel` is authored for everybody and matches in both states. `public` means *signed-out
   * visitors only* — it is one half of the pair that lets a space put a sign-in page and the page behind it on the
   * same path — so a lone `public` page vanishes from the route table the moment anyone has a session, and the
   * space answers 403 to its own owner. Left undefined unless the author means it.
   */
  accessLevel?: 'public' | 'authenticated';
  /**
   * Where a visitor this page is not for is sent — a slug, e.g. `login`.
   *
   * Without it they are answered 403, which is correct and rarely what a site wants: somebody who followed a link
   * to a members page should land on the sign-in, not on a refusal. One field rather than the router's two,
   * because naming the destination and asking to be redirected are one decision.
   */
  unauthorizedRedirect?: string;
  css?: CssSpec;
  /** As {@link ElementSpec.class} — a shared class instead of a selector of this page's own. */
  class?: string | StyleDeclaration;
  flows?: StepSpec[][];
  body: ElementSpec[];
}

/** Per element *type* defaults — what `.plitzi__heading` resolves to before any class applies. */
export interface ElementStyleSpec {
  base?: CssProps;
  variants?: Record<string, CssProps>;
}

export interface SpaceSpec {
  name: string;
  permanentUrl: string;
  /** CSS custom properties, by category. `color` is the usual one. */
  variables?: Partial<StyleVariables>;
  /**
   * Named classes an element can reach with `class`, so a rule is written once.
   *
   * A space-wide stylesheet, and the right place for the rules that describe the space rather than one section of
   * it. `styles()` is the same thing declared next to what it dresses; both end up here.
   */
  classes?: Record<string, CssSpec>;
  elements?: Record<string, ElementStyleSpec>;
  schemaVariables?: SchemaVariable[];
  customCss?: string;
  /**
   * Everything else the schema's settings carry — where sign-in posts to, which cookie hints at a session, how
   * state is kept. `customCss` above is the one field of that same object every space sets, and it stays named on
   * its own for that reason; these are the rest, spread over it.
   */
  settings?: Partial<Omit<Schema['settings'], 'customCss'>>;
  /**
   * Server-resolved data for this space's `runtime: 'server'` elements. It is off unless a space says otherwise,
   * so a space whose providers are fed by the server declares `{ enabled: true }` — without it those elements
   * render from their mock data and nothing anywhere reports a missing switch.
   */
  rsc?: Schema['rsc'];
  mode?: Style['mode'];
  theme?: Style['theme'];
  pages: PageSpec[];
}

/**
 * What a step is allowed to name, supplied by whoever owns the vocabulary.
 *
 * A step is two strings the document cannot check about itself: an `action` and the module it runs on. The runtime
 * resolves one as `callbacksAvailables[<on>][<action>]`, so a pair that names nothing is a control that does
 * nothing at all, with no error anywhere — the single quietest failure this surface has.
 *
 * It arrives as an option rather than as an import because the catalogs live in `@plitzi/sdk-interactions`, which
 * already depends on this package. `@plitzi/sdk-authoring` holds both and passes the real one, so an author who
 * imports from there gets the checks without asking. Authoring straight from this package skips them, which is what
 * makes the fragment usable on documents whose vocabulary nobody here knows.
 */
export interface StepVocabulary {
  /** Global callbacks by action name, each naming the module id it is registered on. */
  globalCallbacks: Record<string, { source: string }>;
  /** Utility actions. A utility is resolved by action alone and runs on no module at all. */
  utilities: Record<string, unknown>;
}

/**
 * Which element types publish a data source, and under what name.
 *
 * Supplied for the same reason {@link StepVocabulary} is: the answer belongs to the elements, and this package is
 * the one they depend on. Without it a binding source is written as declared and only its structure is checked.
 */
export type SourceTypes = Record<string, string>;

export interface AuthorSpaceOptions {
  /**
   * The step vocabulary to hold this space's flows to. Left out, flows are written as declared and only their
   * structure is checked.
   */
  vocabulary?: StepVocabulary;
  /**
   * Element type → the source name it publishes under. Left out, a binding must name the source in full and a
   * prefix that does not match the element it names goes unnoticed.
   */
  sourceTypes?: SourceTypes;
}

export interface AuthoredSpace {
  schema: Schema;
  style: Style;
  /**
   * What an end-to-end suite addresses this space by — every page and element, under the id it was actually given.
   *
   * Returned rather than looked up from the document afterwards, because a spec that leaves an id out is given a
   * derived one, and only the author knows what it minted. See `./handles`.
   */
  handles: SpaceHandles;
  /**
   * What the document validator had to say that was not fatal — a page with no default, a variable nothing reads.
   * Returned rather than printed: a seed may log them, a test may assert on them, and a build may treat them as
   * errors of its own.
   */
  warnings: SchemaValidationError[];
}

/**
 * What a template author declares: a name, a description and a subtree.
 *
 * The style half is declared exactly as a space declares it — the classes the subtree names, the element defaults
 * it relies on, the variables its rules read — because that is precisely what has to TRAVEL with it. A template
 * that names a class the space it lands in happens not to declare renders unstyled, so anything the subtree reads
 * is carried in the manifest rather than assumed.
 */
export interface TemplateSpec {
  name: string;
  description: string;
  /**
   * What this template's ids are derived from, as `permanentUrl` is for a space. Defaults to a slug of the name.
   *
   * Ids are re-generated when the template is dropped into a space, so this decides nothing at run time — it
   * decides only that authoring the same template twice writes the same file.
   */
  key?: string;
  variables?: Partial<StyleVariables>;
  /** As {@link SpaceSpec.classes}. Every class the subtree names has to be declared here, or it does not travel. */
  classes?: Record<string, CssSpec>;
  elements?: Record<string, ElementStyleSpec>;
  schemaVariables?: SchemaVariable[];
  mode?: Style['mode'];
  theme?: Style['theme'];
  /** The subtree, and its root is the element a builder instantiates. */
  root: ElementSpec;
}

export interface AuthoredTemplate {
  /** The manifest as it is published: `JSON.stringify` it and host it. */
  template: Template;
  /**
   * What the validators had to say that was not fatal — a class the template names but does not carry, a step
   * naming an action no built-in source declares. Beside the manifest rather than inside it: what ships is a
   * document a builder fetches, and it carries nothing that is not part of the template.
   */
  warnings: SchemaValidationError[];
}
