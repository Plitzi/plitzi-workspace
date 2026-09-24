import { serverLog } from '../../helpers/serverLog';

import type { Schema } from '@plitzi/sdk-shared';

const reported = new Set<string>();

/**
 * The plugin types a space renders that this server has nothing for — neither a component in the render nor a bundle
 * for the browser. Each prints "Custom Component … Not Found" where the plugin should be, and nothing else anywhere
 * says why, so it is said here: once per space and type, at `error`, because a visitor is looking at the placeholder.
 *
 * A `custom` element carrying its own `scriptUrl` loads itself in the browser and is not this server's to supply.
 */
export const reportMissingPlugins = (
  spaceId: number,
  schema: Schema | undefined,
  available: ReadonlySet<string>
): void => {
  if (!schema || !serverLog.enabled('error')) {
    return;
  }

  for (const element of Object.values(schema.flat)) {
    const { renderType, isPlugin, scriptUrl } = element.attributes;
    const loadsItself = isPlugin === true && typeof scriptUrl === 'string' && scriptUrl !== '';
    if (element.definition.type !== 'custom' || typeof renderType !== 'string' || renderType === '' || loadsItself) {
      continue;
    }

    const key = `${spaceId}:${renderType}`;
    if (available.has(renderType) || reported.has(key)) {
      continue;
    }

    reported.add(key);
    serverLog.error(
      'SSR',
      `Space ${String(spaceId)} renders the plugin "${renderType}" (element "${element.id}"), and this server has none by that name, so the page shows "Custom Component ${renderType} Not Found". Register it in \`plugins\` and name it in the deployment's \`pluginNames\`.`
    );
  }
};
