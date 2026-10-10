import type { InteractionCallback, InteractionCallbackPreviews } from '../types/InteractionTypes';
import type { PluginBuilder, PluginSchema } from '../types/PluginTypes';
import type { ElementDefinition } from '../types/SchemaTypes';
import type { DisplayMode, StyleAttributes } from '../types/StyleTypes';

/**
 * How an element says what it can be authored with.
 *
 * A declaration is data — `type`, default attributes, the metadata the builder shows — and the one thing it could
 * not say until now is what those attributes *are*: `subType: 'h1'` in a default says `string`, not the six
 * headings that exist. That type is already written and already maintained, on the element's own component, so
 * this carries it rather than restating it: `elementDeclaration<HeadingAttributes>()({ … })` brands the
 * declaration with the attributes it accepts, and every factory downstream reads them off the catalogue.
 *
 * A type-level brand rather than a field, because there is nothing to attach at runtime: a declaration is
 * serialized into documents and manifests, and a marker with a value would travel with it. Nothing ever reads
 * `__attributes` — it exists so `AttributesOf` has somewhere to look.
 */

export interface ElementAttributesBrand<A> {
  readonly __attributes: A;
}

/** What every declaration is, whatever else it carries. */
export interface ElementDeclarationData {
  type: string;
  /**
   * The kind of data source this element publishes, when it publishes one.
   *
   * A source is named `<sourceType>_<id>`, and the two halves come from different places: the id is the
   * author's, and this is the ELEMENT'S. They are not always the same word — a `form` publishes under
   * `apiContainer`, because what it offers descendants is a record like any other provider's — so an author who
   * assembles the name from the type they can see writes one that resolves to nothing.
   *
   * Declared here so there is one answer: the component reads it to register under, and the authoring surface
   * reads it to resolve a binding that named the element alone.
   */
  sourceType?: string;
  /**
   * The triggers this type fires on top of the ones every element does (`onClick`, `onLoad`…), by action name.
   *
   * Declared here for the reason `sourceType` is: the component registers exactly these, and the authoring surface
   * reads them to refuse a flow that starts on a trigger its element never fires — an `onSubmit` on the submit
   * button rather than on the form is a flow that is written, saved and silently never runs.
   */
  triggers?: Record<string, InteractionCallback>;
  /**
   * The callbacks this type runs on itself on top of the ones every element does (`setState`, `toggleState`) —
   * their static half. The component adds what only a mounted element has: the function, a title naming its label,
   * options drawn from its children. Read by the authoring surface to refuse a step aimed at an element that does not
   * answer to it — an `openModal` sent to a plain container is a button that does nothing.
   */
  callbacks?: Record<string, InteractionCallback>;
  /**
   * The type this one only works somewhere inside: it reads its state from that element's context, and anywhere
   * else it throws on its first render. A dropdown's panel, a tab container's header and body.
   */
  ancestorType?: string;
  /**
   * The values an enumerated attribute takes — a heading's `subType`, a link's `mode` — by attribute name.
   *
   * A component's props say this in TypeScript, which is gone at run time; an author writing JavaScript, a document
   * that arrived as JSON or a value that went through a cast reaches the element anyway, and `subType: 'h7'` renders an
   * `<h7>`. Written with {@link valuesOf}, so the list cannot drift from the props it mirrors; read by the authoring
   * surface to refuse a value outside it.
   */
  attributeValues?: Record<string, readonly string[]>;
  /**
   * Whether the element is behaviour rather than content — a clock that fires a flow, a listener — and draws nothing on
   * a page (at most a tag in the builder, to have something to select). Read by the page checks (`inspectPage`,
   * `plitzi page check`), which would otherwise wait for it to be on screen and report it hidden.
   */
  drawsNothing?: boolean;
  /**
   * Whether the element shows only some of the children put inside it, chosen as it runs — a dashboard showing the
   * panels of the layout saved for this device, a wizard its current step. Read by the page checks, which then owe none
   * of them on screen; what it draws is still read by the checks of the whole page — images, overflow, legibility.
   */
  choosesChildren?: boolean;
  /**
   * The attributes the page server evaluates against a context of its own, never where the element renders: a
   * provider's `notFound`, read against its answer; a page's title and description, read against its server providers.
   * Interpolated in the element's own scope they resolved to nothing — a `|default(…)` to its fallback — before the
   * reader that has their names could see them. Read by the element runtime, which leaves them as written, and by the
   * authoring lint, which holds them to that context.
   */
  serverTemplates?: readonly string[];
  content?: {
    attributes?: Record<string, unknown>;
    definition?: { label?: string };
  };
}

/**
 * A plugin's declaration: an element of somebody's own, declared the way the built-in ones declare themselves.
 *
 * On top of what {@link ElementDeclarationData} says of any element it carries the whole `content`, because for a
 * plugin that is also what gets PUBLISHED — its build writes it into `plugin-manifest.json`, which the builder, the page
 * server and the MCP server read before they load any code. Data only, so that build can read it without React.
 *
 * `A` is the attributes the element accepts: its component's props, minus what the runtime supplies.
 * `const declaration = { … } satisfies PluginDeclaration<SeatPickerAttributes>` then refuses a default the component
 * does not take.
 */
export interface PluginDeclaration<A extends object = Record<string, unknown>> extends Omit<
  ElementDeclarationData,
  'content'
> {
  content: {
    /** The element's starting attributes — its component's defaults, where the builder can show them. */
    attributes: A;
    definition: Omit<ElementDefinition, 'rootId' | 'parentId' | 'interactions' | 'runtime' | 'loadStrategy'> & {
      /** What the element is for, in a sentence: the builder shows it, and an agent reads it to choose the element. */
      description?: string;
    };
    builder: PluginBuilder;
    /** How the builder's catalogue shows the element. Whether it is verified is the platform's to say, never its own. */
    market: {
      category: string;
      owner: string;
      license: string;
      website: string;
      backgroundColor: string;
      icon: string;
    };
    defaultStyle: PluginSchema['defaultStyle'];
    settings?: Record<string, string | number | boolean>;
  };
}

/**
 * The attributes a declaration accepts, defaulting to "anything" for one that never said.
 *
 * That default is the plugin case rather than an oversight: a type that arrives from a manifest at runtime has no
 * TypeScript to offer, and refusing to author it would be worse than authoring it loosely.
 */
export type AttributesOf<D> = D extends ElementAttributesBrand<infer A> ? A : Record<string, unknown>;

type AuthorableProps<Props, Injected extends keyof Props> = Omit<Props, 'ref' | 'className' | 'children' | Injected>;

/**
 * The authorable half of an element's props.
 *
 * `ref`, `className` and `children` are the element machinery's, not the author's — the first two are how a
 * rendered element receives what the document already decided, and children are a tree, declared as one. Anything
 * else a component is handed and the author does not choose (a form control's `value` and change handler, arriving
 * from the form around it) is named per element, where the reason is visible.
 *
 * Everything comes out optional: an attribute left out is the declaration's default, which is the whole point of a
 * declaration having them.
 *
 * A component with nothing authorable comes out `unknown`, not `{}`. A factory's props are these attributes
 * intersected with the authoring fields, and `unknown` is what adds nothing to that intersection — while `{}` means
 * "any value that is not null" everywhere else it could land.
 */
export type AuthorableAttributes<Props, Injected extends keyof Props = never> = keyof AuthorableProps<
  Props,
  Injected
> extends never
  ? unknown
  : Partial<AuthorableProps<Props, Injected>>;

/**
 * Every value of a string-literal union, as a list — and a compile error when the list leaves one out.
 *
 * `valuesOf<NonNullable<ButtonProps['subType']>>()(['button', 'submit', 'reset'])`. A value outside the union is
 * refused by the parameter type; one the union has and the list does not makes the argument ask for `missing`.
 */
export const valuesOf =
  <T extends string>() =>
  <const V extends readonly T[]>(
    values: V & ([Exclude<T, V[number]>] extends [never] ? unknown : { readonly missing: Exclude<T, V[number]> })
  ): readonly string[] =>
    values;

/**
 * The builder's gestures every element allows unless it says otherwise. A new object on every call: a declaration is
 * data its readers keep and may change, and two elements must never share one list.
 */
const builderDefaults = (): Required<PluginBuilder> => ({
  canDelete: true,
  canSelect: true,
  canDragDrop: true,
  canMove: true,
  canSnippet: true,
  itemsAllowed: [],
  itemsNotAllowed: []
});

/** The definition every element starts with unless it says otherwise, around what it does say. */
const definitionWith = <Definition extends { styleSelectors?: Record<string, string> }>(
  type: string,
  definition: Definition
) => ({
  type,
  bindings: {},
  initialState: { visibility: true },
  ...definition,
  styleSelectors: { base: '', ...definition.styleSelectors }
});

/** What a built-in element writes in its declaration's `content`: what is its own — the rest is filled in. */
export interface ElementContentSpec {
  attributes: Record<string, unknown>;
  /** Left out: `type` (the declaration's), no bindings, visible, and the `base` style selector beside its own. */
  definition: Omit<
    Partial<ElementDefinition>,
    'type' | 'rootId' | 'parentId' | 'interactions' | 'runtime' | 'styleSelectors'
  > & {
    label: string;
    /** What the element is for, in a sentence: the builder shows it, and an agent reads it to choose the element. */
    description?: string;
    styleSelectors?: Record<string, string>;
  };
  /** Left out, every gesture, and children of any type. */
  builder?: PluginBuilder;
  /** Its place in the catalogue; the rest is Plitzi's own entry. */
  market: { category: string; icon: string };
  /** Left out: named by its label, for desktop. */
  defaultStyle: {
    name?: string;
    displayMode?: DisplayMode;
    style: StyleAttributes;
    /** A style of its own for each `subType` — a heading's `h1`… — written whole. */
    subTypes?: Record<string, { name: string; displayMode: DisplayMode; style: StyleAttributes }>;
  };
  settings?: Record<string, string | number | boolean>;
}

/** What {@link elementDeclaration} takes: the declaration as written, `content` holding only what is the element's. */
export interface ElementDeclarationSpec extends Omit<ElementDeclarationData, 'content'> {
  content: ElementContentSpec;
}

/** What {@link elementDeclaration} fills in, typed as the declaration then carries it. */
export interface ElementContentDefaults {
  definition: {
    type: string;
    bindings: NonNullable<ElementDefinition['bindings']>;
    initialState: Record<string, unknown>;
    styleSelectors: Record<string, string> & { base: string };
  };
  builder: Required<PluginBuilder>;
  market: { owner: string; verified: boolean; license: string; website: string; backgroundColor: string };
  defaultStyle: { name: string; displayMode: DisplayMode };
  settings: Record<string, string | number | boolean>;
}

/** A built-in element's whole declaration: what it wrote, what was filled in, and the attributes it accepts. */
export type DeclaredElement<D extends ElementDeclarationSpec, A> = D & {
  content: ElementContentDefaults;
} & ElementAttributesBrand<A>;

/**
 * A built-in element's declaration, written from what is its own — its type, words, attributes, style, place in the
 * catalogue — with the rest at the defaults every element shares: the builder's gestures, Plitzi's catalogue entry,
 * a visible element with no bindings, its style named by its label.
 *
 * Called twice, as {@link definePlugin} is: the first call takes the attributes the element accepts, the second the
 * declaration.
 */
export const elementDeclaration =
  <A>() =>
  // `const` so the declaration's own `type` stays the literal it was written as: the authoring surface maps a
  // document type name back to the element that declares it, and a widened `string` collapses that map into one
  // union of every element there is.
  <const D extends ElementDeclarationSpec>(declaration: D): DeclaredElement<D, A> => {
    const { definition, builder, market, defaultStyle, settings } = declaration.content;
    const filled = {
      ...declaration,
      content: {
        ...declaration.content,
        definition: definitionWith(declaration.type, definition),
        builder: { ...builderDefaults(), ...builder },
        market: {
          owner: 'Plitzi',
          verified: true,
          license: 'MIT',
          website: 'https://plitzi.com',
          backgroundColor: '#4422ee',
          ...market
        },
        defaultStyle: { name: definition.label, displayMode: 'desktop' as const, ...defaultStyle },
        settings: settings ?? {}
      }
    };

    // Each default was filled in above and the brand is type-only: the object is the declaration it says it is, which
    // spreading a generic `D` cannot tell the compiler.
    return filled as unknown as DeclaredElement<D, A>;
  };

/** An event a plugin fires, as {@link definePlugin} takes it: what a flow it starts reads (`preview`) — the rest derived. */
export type PluginTriggerSpec = {
  /** Left out, the event's name in words: `onEdit` is "On Edit". */
  title?: string;
  /** What a flow started by it reads, `{ ops: '' }` — and so what the plugin hands it (`usePluginTrigger`). */
  preview?: InteractionCallbackPreviews;
  params?: InteractionCallback['params'];
};

/** An action a plugin answers, as {@link definePlugin} takes it: its params — the rest derived. */
export type PluginCallbackSpec = { title?: string; params?: InteractionCallback['params'] };

type PluginContent<A extends object> = PluginDeclaration<A>['content'];

/** What a plugin is, said once: {@link definePlugin} writes the rest of its declaration from it. */
export interface PluginSpec<
  A extends object,
  T extends Record<string, PluginTriggerSpec>,
  C extends Record<string, PluginCallbackSpec>
> extends Omit<ElementDeclarationData, 'type' | 'triggers' | 'callbacks' | 'content'> {
  /** What a space names it by — the element type. Renaming it orphans every one. */
  type: string;
  /** What the builder's catalogue calls it. */
  label: string;
  /** What it is for, in a sentence: the builder shows it, and an agent reads it to choose the element. */
  description?: string;
  /** Its starting attributes: the component's defaults. */
  attributes: A;
  triggers?: T;
  callbacks?: C;
  /** What the builder lets a person do with it. Left out, every gesture, and no children. */
  builder?: PluginBuilder;
  /** How the catalogue shows it. Left out, under its label, by nobody, MIT. */
  market?: Partial<PluginContent<A>['market']>;
  /** The attributes a data source may be pointed at. Left out, every one. */
  bindable?: readonly (keyof A & string)[];
  /** Its style before anybody styles it. */
  style?: PluginSchema['defaultStyle']['style'];
  /** More of the element's definition — children it starts with (`items`), its style selectors. */
  definition?: Partial<PluginContent<A>['definition']>;
  settings?: PluginContent<A>['settings'];
}

/** A plugin's events and actions as its declaration carries them: each named by its key, its preview kept as written. */
export type DeclaredTriggers<T extends Record<string, PluginTriggerSpec>> = {
  [K in keyof T & string]: Omit<InteractionCallback, 'action' | 'preview'> & {
    action: K;
    preview: T[K]['preview'] extends object ? T[K]['preview'] : Record<string, never>;
  };
};

export type DeclaredCallbacks<C extends Record<string, PluginCallbackSpec>> = {
  [K in keyof C & string]: Omit<InteractionCallback, 'action'> & { action: K };
};

/** What {@link definePlugin} answers: the declaration, its events and actions named, and its attributes in its type. */
export type DefinedPlugin<
  A extends object,
  T extends Record<string, PluginTriggerSpec>,
  C extends Record<string, PluginCallbackSpec>
> = Omit<PluginDeclaration<A>, 'triggers' | 'callbacks'> & {
  triggers: DeclaredTriggers<T>;
  callbacks: DeclaredCallbacks<C>;
} & ElementAttributesBrand<A>;

/** A name as words: `onEdit` → "On Edit", `seatPicker` → "Seat Picker". */
const wordsOf = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, first => first.toUpperCase());

/**
 * A plugin's declaration, written from what only it can say — its type, its words, its attributes, what it fires and
 * answers — with everything else at the default every plugin shares: the builder's gestures, the catalogue entry, a
 * bindable attribute for each one, an empty style.
 *
 * ```ts
 * export default definePlugin<SeatPickerAttributes>()({
 *   type: 'seatPicker',
 *   label: 'Seat Picker',
 *   description: 'Picks a seat from a plan.',
 *   attributes: { start: 0, label: 'Seats' },
 *   triggers: { onPick: { preview: { seat: '' } } },
 *   callbacks: { reset: {} }
 * });
 * ```
 *
 * Called twice, as `elementDeclaration` is: the first call takes the attributes the element accepts (its component's
 * props, minus what the runtime supplies), which TypeScript cannot read off defaults that leave some out; the second the
 * rest, whose events it reads as written. The whole declaration comes back — what the build writes into the manifest
 * and the builder reads — branded with the attributes, so `defineElement(declaration)` authors the element typed
 * without being told.
 */
export const definePlugin =
  <A extends object>() =>
  <
    const T extends Record<string, PluginTriggerSpec> = never,
    const C extends Record<string, PluginCallbackSpec> = never
  >({
    type,
    label,
    description,
    attributes,
    triggers,
    callbacks,
    builder,
    market,
    bindable,
    style,
    definition,
    settings,
    ...rest
  }: PluginSpec<A, T, C>): DefinedPlugin<A, T, C> => {
    const callbackOf = (
      kind: 'trigger' | 'callback',
      action: string,
      spec: PluginTriggerSpec
    ): InteractionCallback => ({
      action,
      title: spec.title ?? wordsOf(action),
      type: kind,
      params: spec.params ?? {},
      ...(kind === 'trigger' ? { preview: spec.preview ?? {} } : {})
    });
    // `Object.keys` answers `string[]` for any object; these are the keys of `attributes`, which is an `A`.
    const bound = bindable ?? (Object.keys(attributes) as (keyof A & string)[]);
    const declaration = {
      ...rest,
      type,
      triggers: Object.fromEntries(
        Object.entries(triggers ?? {}).map(([action, spec]) => [action, callbackOf('trigger', action, spec)])
      ),
      callbacks: Object.fromEntries(
        Object.entries(callbacks ?? {}).map(([action, spec]) => [action, callbackOf('callback', action, spec)])
      ),
      content: {
        attributes,
        definition: definitionWith(type, {
          label,
          ...(description ? { description } : {}),
          items: [],
          ...definition
        }),
        builder: { ...builderDefaults(), ...builder },
        market: {
          category: label,
          owner: '',
          license: 'MIT',
          website: '',
          backgroundColor: '#4422ee',
          icon: '',
          ...market
        },
        defaultStyle: {
          name: label,
          displayMode: 'desktop' as const,
          style: style ?? { base: { default: {} } },
          bindingsAllowed: {
            attributes: bound.map(path => ({ path, label: wordsOf(path) })),
            initialState: []
          }
        },
        settings: settings ?? {}
      }
    };

    // The triggers and callbacks were built from `T` and `C` key by key, and the brand is type-only — the object is the
    // declaration it says it is, which `Object.fromEntries` cannot tell the compiler.
    return declaration as unknown as DefinedPlugin<A, T, C>;
  };
