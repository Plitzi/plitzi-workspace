import { interactionBasicTriggers } from '@plitzi/sdk-elements/Element/helpers/elementConstants';
import { BUILTIN_ELEMENT_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';

import { defineElement } from './element';
import { CUSTOM_TYPE } from '../schema/lint/context';

import type { AuthorSpaceOptions, PluginDeclarationData } from '../schema';
import type { ElementFactory } from './element';
import type { PluginManifest, PluginSchema } from '@plitzi/sdk-shared';

/**
 * Factories for the element types a plugin publishes.
 *
 * A plugin's `pluginSchema` entry has the same shape as a built-in element's declaration — attributes, definition,
 * builder metadata, default style — which is the whole reason authoring a plugin type costs nothing extra: the
 * manifest a deployment already fetches to render the space is also what makes its types authorable.
 *
 * Types are the caller's to supply, since a manifest is JSON and carries none:
 * `elementsFromManifest<{ chart: ChartAttributes }>(manifest)`.
 */
export const elementsFromManifest = <A extends Record<string, object> = Record<string, Record<string, unknown>>>(
  manifest: PluginManifest
): { [Type in keyof A]: ElementFactory<A[Type]> } =>
  Object.fromEntries(
    Object.entries(manifest.pluginSchema).map(([type, schema]: [string, PluginSchema]) => [
      type,
      defineElement({
        type,
        content: { attributes: schema.attributes, definition: { label: schema.definition.label } }
      })
    ])
  ) as { [Type in keyof A]: ElementFactory<A[Type]> };

const actionsOf = (entries: Readonly<Record<string, { action: string }>> | undefined): string[] =>
  Object.values(entries ?? {}).map(entry => entry.action);

/**
 * The attributes a declared plugin reads: its starting attributes and the ones it lets a data source write.
 *
 * `null` — "reads anything" — when it declares neither, so a declaration that says nothing about attributes is not
 * turned into one that refuses all of them.
 */
const attributesOf = (declaration: PluginDeclarationData): string[] | null => {
  const names = new Set([
    ...Object.keys(declaration.content?.attributes ?? {}),
    ...(declaration.content?.defaultStyle?.bindingsAllowed?.attributes ?? []).map(entry => entry.path)
  ]);

  return names.size ? [...names] : null;
};

/**
 * The catalogs `authorSpace` holds a space to, with each declared plugin in them as if it were built in.
 *
 * Every catalog a built-in element is checked against is derived from its declaration; a plugin's declaration has
 * the same shape, so its type gets the same checks — its triggers and callbacks join the step vocabulary, its
 * attributes the attribute list, its source name the source table. Without this a plugin type was a name the linter
 * waved through, and a flow on an event it never fires was written, saved and never ran.
 */
export const withPluginCatalogs = (options: AuthorSpaceOptions): AuthorSpaceOptions => {
  const { plugins, ...rest } = options;
  if (!plugins?.length) {
    return rest;
  }

  /**
   * Each plugin, under both names a space can use it by: its own type (a plugin package, authored with
   * `defineElement`) and `custom:<type>` (a component of the project's own, hosted by `custom({ renderType })`). The
   * hosted form is the `custom` element's own vocabulary plus the component's.
   */
  const hostedKey = (declaration: PluginDeclarationData): string => `${CUSTOM_TYPE}:${declaration.type}`;
  const byType = <T>(
    own: (declaration: PluginDeclarationData) => T | undefined,
    hosted: (declaration: PluginDeclarationData) => T | undefined = own
  ): Record<string, T> =>
    Object.fromEntries(
      plugins.flatMap(declaration => {
        const entries: [string, T | undefined][] = [
          [declaration.type, own(declaration)],
          [hostedKey(declaration), hosted(declaration)]
        ];

        return entries.filter((entry): entry is [string, T] => entry[1] !== undefined);
      })
    );

  const customTriggers = rest.vocabulary?.triggers?.[CUSTOM_TYPE] ?? Object.keys(interactionBasicTriggers);
  const customCallbacks = rest.vocabulary?.callbacks?.[CUSTOM_TYPE] ?? Object.keys(BUILTIN_ELEMENT_CALLBACKS);
  const customAttributes = Object.keys(rest.defaultAttributes?.[CUSTOM_TYPE] ?? {});

  const vocabulary = rest.vocabulary && {
    ...rest.vocabulary,
    triggers: {
      ...rest.vocabulary.triggers,
      ...byType(
        declaration => [...Object.keys(interactionBasicTriggers), ...actionsOf(declaration.triggers)],
        declaration => [...customTriggers, ...actionsOf(declaration.triggers)]
      )
    },
    callbacks: {
      ...rest.vocabulary.callbacks,
      ...byType(
        declaration => [...Object.keys(BUILTIN_ELEMENT_CALLBACKS), ...actionsOf(declaration.callbacks)],
        declaration => [...customCallbacks, ...actionsOf(declaration.callbacks)]
      )
    }
  };

  return {
    ...rest,
    ...(vocabulary ? { vocabulary } : {}),
    pluginTypes: [
      ...(rest.pluginTypes ?? []),
      ...plugins.flatMap(declaration => [declaration.type, hostedKey(declaration)])
    ],
    sourceTypes: { ...rest.sourceTypes, ...byType(declaration => declaration.sourceType) },
    attributeNames: {
      ...rest.attributeNames,
      ...byType(attributesOf, declaration => {
        const names = attributesOf(declaration);

        return names && [...customAttributes, ...names];
      })
    },
    defaultAttributes: {
      ...rest.defaultAttributes,
      ...byType(declaration => ({ ...declaration.content?.attributes }))
    },
    slotNames: {
      ...rest.slotNames,
      ...byType(declaration =>
        Object.keys(declaration.content?.definition?.styleSelectors ?? {}).filter(slot => slot !== 'base')
      )
    },
    // A plugin package holds children only when its definition says so — as the built-in elements do.
    leafTypes: [
      ...(rest.leafTypes ?? []),
      ...plugins
        .filter(declaration => declaration.content?.definition && !Array.isArray(declaration.content.definition.items))
        .map(declaration => declaration.type)
    ]
  };
};
