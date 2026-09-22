import { interactionBasicTriggers } from '@plitzi/sdk-elements/Element/helpers/elementConstants';
import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';
import { BUILTIN_ELEMENT_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';

import type { InteractionCallback } from '@plitzi/sdk-shared';

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
  content?: { definition?: { styleSelectors?: Record<string, unknown> } };
  sourceType?: string;
  triggers?: Record<string, InteractionCallback>;
  callbacks?: Record<string, InteractionCallback>;
  ancestorType?: string;
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
 * A source is `<sourceType>_<id>`, and only the id half is the author's. The other half belongs to the
 * element and is not always the word the author can see: a `form` publishes under `apiContainer`. Assembled by
 * hand that is a binding that resolves to nothing with nothing reporting it, so the authoring surface resolves it
 * from here instead — an author names the element and the prefix is looked up.
 *
 * Derived from the declarations, which the components themselves register under, so there is no second list to
 * keep in step with the runtime.
 */
export const elementSourceTypes: Record<string, string> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>)
    .filter(declaration => declaration.sourceType)
    .map(declaration => [declaration.type, declaration.sourceType as string])
);

/**
 * Every trigger each built-in type fires: the ones all elements share, and the ones its declaration adds.
 *
 * What lets a flow on the wrong element be refused instead of written. The trigger names an event, and only the
 * element that fires it ever starts the flow — an `onSubmit` on a form's submit button is saved, looks right beside
 * the form, and never runs, which is how a working form reads as "forms do not work outside the builder".
 */
export const elementTriggers: Record<string, string[]> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>).map(declaration => [
    declaration.type,
    [...Object.keys(interactionBasicTriggers), ...Object.keys(declaration.triggers ?? {})]
  ])
);

/** The triggers only some types fire, by action name — for a step builder that wants the title the builder shows. */
export const typeTriggerDefinitions: Record<string, InteractionCallback> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>).flatMap(declaration =>
    Object.entries(declaration.triggers ?? {})
  )
);

/**
 * Every element callback each built-in type answers to: `setState` and `toggleState`, which every element registers,
 * and the ones its declaration adds.
 *
 * A callback runs on the element it names, so aiming it at one of the wrong type is the same silent dead end as a
 * trigger on the wrong element — the builder offers `openModal` only on a modal, and a hand-written step does not.
 */
export const elementCallbacks: Record<string, string[]> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>).map(declaration => [
    declaration.type,
    [...Object.keys(BUILTIN_ELEMENT_CALLBACKS), ...Object.keys(declaration.callbacks ?? {})]
  ])
);

/** The sub-elements that only work inside another type, and that type — see `ElementDeclarationData.ancestorType`. */
export const elementAncestorTypes: Record<string, string> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>)
    .filter(declaration => declaration.ancestorType)
    .map(declaration => [declaration.type, declaration.ancestorType as string])
);
