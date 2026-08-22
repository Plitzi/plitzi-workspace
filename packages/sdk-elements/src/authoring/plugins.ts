import { defineElement } from './element';

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
