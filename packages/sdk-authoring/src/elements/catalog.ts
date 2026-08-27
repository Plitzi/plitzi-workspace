import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

/**
 * What each built-in element IS, read off the declarations rather than listed somewhere.
 *
 * This used to be a hand-curated table in the MCP — the only place that said what a type is FOR, and by the time
 * it was replaced it had never heard of `pagination`, `richText` or `themeToggle`, which is what a hand-kept
 * mirror always ends up being. The text now lives on the element, next to the props it describes, so an element
 * that declares itself is documented everywhere at once: the agent's type registry, the offline render guide, a
 * deployment's component catalog and an editor's tooltip over a factory.
 *
 * The structural half — attributes, style selectors, default style — is on the declarations too. A deployment
 * builds its catalog from the element library it already ships (`getComponentCatalog`), and this is the half that
 * needs no library to read.
 */

export interface ElementSemantics {
  /** Human name of the type, e.g. "Api Container". */
  label: string;
  /** What the type is FOR — so whoever is authoring picks the right one instead of inventing one. */
  description: string;
  /** Grouping: provider, structure, media, form, basic, advanced, internal. */
  category: string;
}

type DeclarationShape = {
  type: string;
  sourceType?: string;
  content?: {
    definition?: { label?: string; description?: string };
    market?: { category?: string };
  };
};

/** Keyed by the schema `type`, which is what a document and every catalog address a type by. */
export const elementCatalog: Record<string, ElementSemantics> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>).map(declaration => [
    declaration.type,
    {
      label: declaration.content?.definition?.label ?? declaration.type,
      description: declaration.content?.definition?.description ?? '',
      category: declaration.content?.market?.category ?? 'basic'
    }
  ])
);

/** Every built-in type name, for anything that has to tell a known type from one a plugin has to provide. */
export const elementTypeNames: string[] = Object.keys(elementCatalog);

/**
 * Which types publish a data source, and under what name.
 *
 * A source is `<sourceType>_<idRef>`, and only the idRef half is the author's. The other half belongs to the
 * element and is not always the word the author can see: a `form` publishes under `apiContainer`. Assembled by
 * hand that is a binding that resolves to nothing with nothing reporting it, so the authoring surface resolves it
 * from here instead — an author names the idRef and the prefix is looked up.
 *
 * Derived from the declarations, which the components themselves register under, so there is no second list to
 * keep in step with the runtime.
 */
export const elementSourceTypes: Record<string, string> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>)
    .filter(declaration => declaration.sourceType)
    .map(declaration => [declaration.type, declaration.sourceType as string])
);
