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
  content?: {
    attributes?: Record<string, unknown>;
    definition?: { label?: string };
  };
}

/**
 * The attributes a declaration accepts, defaulting to "anything" for one that never said.
 *
 * That default is the plugin case rather than an oversight: a type that arrives from a manifest at runtime has no
 * TypeScript to offer, and refusing to author it would be worse than authoring it loosely.
 */
export type AttributesOf<D> = D extends ElementAttributesBrand<infer A> ? A : Record<string, unknown>;

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
 */
export type AuthorableAttributes<Props, Injected extends keyof Props = never> = Partial<
  Omit<Props, 'ref' | 'className' | 'children' | Injected>
>;

export const elementDeclaration =
  <A>() =>
  // `const` so the declaration's own `type` stays the literal it was written as: the authoring surface maps a
  // document type name back to the element that declares it, and a widened `string` collapses that map into one
  // union of every element there is.
  <const D extends ElementDeclarationData>(declaration: D): D & ElementAttributesBrand<A> =>
    // The brand is type-only and there is no value to attach, which is exactly why this cast has no runtime
    // counterpart: what comes back is the same object it was handed.
    declaration as D & ElementAttributesBrand<A>;
