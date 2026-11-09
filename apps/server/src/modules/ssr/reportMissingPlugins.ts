import { serverLog } from '@plitzi/sdk-kernel/log';

import type { Schema } from '@plitzi/sdk-shared';

const reported = new Set<string>();

/**
 * The plugin types a space renders that this server has nothing for — neither a component in the render nor a bundle
 * for the browser. Each prints "Custom Component … Not Found" where the plugin should be, and nothing else anywhere
 * says why, so it is said here: once per space and type, at `error`, because a visitor is looking at the placeholder.
 *
 * A `custom` element carrying its own `scriptUrl` loads itself in the browser and is not this server's to supply.
 */
/** The plugins a space's elements render, by type: the first element of each. */
type CustomRenders = ReadonlyMap<string, string>;

const customRendersOf = new WeakMap<Schema, CustomRenders>();

/**
 * The plugins a schema's elements render, read once per schema object: the adapters hand every render the same one
 * until the space changes, and walking every element of a large space on each render was a few percent of its CPU.
 */
const customRenders = (schema: Schema): CustomRenders => {
  const known = customRendersOf.get(schema);
  if (known) {
    return known;
  }

  const renders = new Map<string, string>();
  for (const element of Object.values(schema.flat)) {
    const { renderType, isPlugin, scriptUrl } = element.attributes;
    const loadsItself = isPlugin === true && typeof scriptUrl === 'string' && scriptUrl !== '';
    if (element.definition.type !== 'custom' || typeof renderType !== 'string' || renderType === '' || loadsItself) {
      continue;
    }

    if (!renders.has(renderType)) {
      renders.set(renderType, element.id);
    }
  }

  customRendersOf.set(schema, renders);

  return renders;
};

export const reportMissingPlugins = (
  spaceId: number,
  schema: Schema | undefined,
  available: ReadonlySet<string>
): void => {
  if (!schema || !serverLog.enabled('error')) {
    return;
  }

  for (const [renderType, elementId] of customRenders(schema)) {
    const key = `${spaceId}:${renderType}`;
    if (available.has(renderType) || reported.has(key)) {
      continue;
    }

    reported.add(key);
    serverLog.error(
      'SSR',
      `Space ${String(spaceId)} renders the plugin "${renderType}" (element "${elementId}"), and this server has none by that name, so the page shows "Custom Component ${renderType} Not Found". Register it in \`plugins\` and name it in the deployment's \`pluginNames\`.`
    );
  }
};
