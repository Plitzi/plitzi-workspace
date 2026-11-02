import { CUSTOM_TYPE, textOf } from '../lint/context';

import type { Suggestion } from './types';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * A `custom` element naming, by `renderType`, a plugin whose declaration the space was handed.
 *
 * It renders — a `custom` host loads the plugin's elements as an element of their own type does — so nothing here is
 * wrong. But a plugin is placed one way: from its declaration, `defineElement(declaration)`, typed by what
 * it declares and the same element the builder adds when somebody drops it. A `custom` host is for a component
 * registered by name with no declaration.
 */
export const suggestPluginHosts = (schema: Schema, pluginTypes: readonly string[]): Suggestion[] => {
  // A declared plugin is listed under the name its `custom` host is checked by, as the linter reads it.
  const declared = new Set(pluginTypes.filter(type => type.startsWith(`${CUSTOM_TYPE}:`)));
  if (declared.size === 0) {
    return [];
  }

  return [schema.flat, ...Object.values(schema.components).map(component => component.flat)]
    .flatMap(flat => Object.values(flat))
    .flatMap(element => {
      const type = textOf(element.attributes.renderType);
      if (element.definition.type !== CUSTOM_TYPE || !declared.has(`${CUSTOM_TYPE}:${type}`)) {
        return [];
      }

      return [
        {
          code: 'plugin-custom-host' as const,
          message:
            `"${element.id}" places the plugin "${type}" by name, with \`custom({ renderType: '${type}' })\`: place it ` +
            `from its declaration — \`const ${type} = defineElement(declaration)\`, then ` +
            `\`${type}({ id: '${element.id}', … })\` — typed by what it declares, as the builder adds it.`,
          elementIds: [element.id],
          saves: 0
        }
      ];
    });
};

/**
 * Each plugin the project declares that no page, layout or component places: built, shipped, and drawn nowhere. A run's
 * border light lost its only placement to another task, and author, lint, doctor and every check said nothing.
 */
export const suggestUnusedPlugins = (schema: Schema, pluginTypes: readonly string[]): Suggestion[] => {
  const declared = pluginTypes.flatMap(type =>
    type.startsWith(`${CUSTOM_TYPE}:`) ? [type.slice(CUSTOM_TYPE.length + 1)] : []
  );
  if (declared.length === 0) {
    return [];
  }

  const placed = new Set(
    [schema.flat, ...Object.values(schema.components).map(component => component.flat)]
      .flatMap(flat => Object.values(flat))
      .map(element =>
        element.definition.type === CUSTOM_TYPE ? textOf(element.attributes.renderType) : element.definition.type
      )
  );
  const unused = declared.filter(type => !placed.has(type)).sort();

  return unused.length === 0
    ? []
    : [
        {
          code: 'unused-plugin' as const,
          message: `${String(unused.length)} ${unused.length === 1 ? 'plugin is' : 'plugins are'} declared and placed on no page, layout or component: ${unused.join(', ')} — built and shipped, drawn nowhere. Place ${unused.length === 1 ? 'it' : 'them'} where ${unused.length === 1 ? 'it was' : 'they were'} meant to go, or remove ${unused.length === 1 ? 'its folder' : 'their folders'} from src/plugins/.`,
          elementIds: [],
          subjects: unused,
          saves: 0
        }
      ];
};
