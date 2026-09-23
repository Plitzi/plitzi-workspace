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
  sourceType?: string;
  triggers?: Record<string, InteractionCallback>;
  callbacks?: Record<string, InteractionCallback>;
  ancestorType?: string;
  attributeValues?: Record<string, readonly string[]>;
  content?: {
    attributes?: Readonly<Record<string, unknown>>;
    definition?: {
      label?: string;
      description?: string;
      styleSelectors?: Record<string, unknown>;
      items?: readonly unknown[];
    };
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

/**
 * The OTHER selectors each type dresses — a modal's `rootContainer`, a form control's `input` — by type.
 *
 * Every element carries a class per slot (`plitzi__<type>-<slot>`), and that is what a space's per-type `slots` style
 * addresses. A document that names only the slots its author styled leaves the rest of them classless, so the style
 * the space wrote for the TYPE reaches some of its elements and not others — which is a themed modal beside a white one.
 */
export const elementSlots: Record<string, string[]> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>).map(declaration => [
    declaration.type,
    Object.keys(declaration.content?.definition?.styleSelectors ?? {}).filter(slot => slot !== 'base')
  ])
);

/**
 * The types that hold no children — a heading, a text, an image, a form control.
 *
 * Their components render their own attributes and never read `children`, so anything nested in one is dropped
 * without a word: a two-tone heading authored as a heading with two texts in it renders the word "Heading". A type
 * that can hold children says so by declaring `items`, which is also what lets the builder drop into it.
 */
export const elementLeafTypes: string[] = Object.values(elementDeclarations as Record<string, DeclarationShape>)
  .filter(declaration => !Array.isArray(declaration.content?.definition?.items))
  .map(declaration => declaration.type);

/** The attributes each built-in type starts with — what a factory merges under the author's own. */
export const elementDefaultAttributes: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>).map(declaration => [
    declaration.type,
    { ...declaration.content?.attributes }
  ])
);

/** The values each built-in type's enumerated attributes take — a heading's `subType`, a link's `mode`. */
export const elementAttributeValues: Record<string, Record<string, readonly string[]>> = Object.fromEntries(
  Object.values(elementDeclarations as Record<string, DeclarationShape>)
    .filter(declaration => declaration.attributeValues)
    .map(declaration => [declaration.type, { ...declaration.attributeValues }])
);
