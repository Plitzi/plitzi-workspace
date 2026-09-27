import type { InteractionCallback } from '../types/InteractionTypes';
import type { PluginBuilder, PluginSchema } from '../types/PluginTypes';
import type { ElementDefinition } from '../types/SchemaTypes';

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

export const elementDeclaration =
  <A>() =>
  // `const` so the declaration's own `type` stays the literal it was written as: the authoring surface maps a
  // document type name back to the element that declares it, and a widened `string` collapses that map into one
  // union of every element there is.
  <const D extends ElementDeclarationData>(declaration: D): D & ElementAttributesBrand<A> =>
    // The brand is type-only and there is no value to attach, which is exactly why this cast has no runtime
    // counterpart: what comes back is the same object it was handed.
    declaration as D & ElementAttributesBrand<A>;
