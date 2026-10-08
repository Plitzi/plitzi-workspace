import { CUSTOM_TYPE, textOf } from '../lint/context';

import type { Suggestion } from './types';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * A `custom` element naming, by `renderType`, a plugin whose declaration the space was handed.
 *
 * It renders — a `custom` host loads the plugin's elements as an element of their own type does — so nothing here is
 * wrong. But a plugin is placed one way: from its declaration, `defineElement<…Attributes>(declaration)`, typed by what
 * it declares and the same element the builder adds when somebody drops it. A `custom` host is for a component
 * registered by name with no declaration.
 */
export const suggestPluginHosts = (schema: Schema, pluginTypes: readonly string[]): Suggestion[] => {
  if (pluginTypes.length === 0) {
    return [];
  }

  const declared = new Set(pluginTypes);

  return [schema.flat, ...Object.values(schema.components).map(component => component.flat)]
    .flatMap(flat => Object.values(flat))
    .flatMap(element => {
      const type = textOf(element.attributes.renderType);
      if (element.definition.type !== CUSTOM_TYPE || !declared.has(type)) {
        return [];
      }

      return [
        {
          code: 'plugin-custom-host' as const,
          message:
            `"${element.id}" places the plugin "${type}" by name, with \`custom({ renderType: '${type}' })\`: place it ` +
            `from its declaration — \`const ${type} = defineElement<…Attributes>(declaration)\`, then ` +
            `\`${type}({ id: '${element.id}', … })\` — typed by what it declares, as the builder adds it.`,
          elementIds: [element.id],
          saves: 0
        }
      ];
    });
};
