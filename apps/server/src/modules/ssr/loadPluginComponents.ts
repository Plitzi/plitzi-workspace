import type { PluginEntry, SSRPlugin } from '@plitzi/sdk-shared';
import type { FC } from 'react';

/** Module-level cache: absolute filePath → loaded React component. */
const componentCache = new Map<string, FC>();

/**
 * Plugins that failed to import (e.g. browser-only code like `document`).
 * These are permanently skipped on the server and fall through to client-side rendering.
 */
const failedImports = new Set<string>();

/**
 * Dynamically imports plugin components from their compiled filesystem paths and returns
 * a Record<keyName, FC> suitable for passing to <PlitziSdk.Plugin>.
 *
 * File-source plugins are cached by filePath so subsequent requests skip the import().
 * Plugins that fail to import are added to a permanent skip-list — they are not retried
 * and will be rendered client-side instead.
 * Component-source plugins (already in memory via getComponents()) are merged in directly.
 */
export const loadPluginComponents = async (
  entries: PluginEntry[],
  inlineComponents?: Record<string, unknown>
): Promise<Record<string, SSRPlugin>> => {
  const result: Record<string, SSRPlugin> = {};

  // Merge component-source plugins provided directly by the PluginManager
  if (inlineComponents) {
    for (const [key, component] of Object.entries(inlineComponents)) {
      result[key] = { component: component as FC, props: {} };
    }
  }

  // Dynamically import file-source plugins (compiled or downloaded to disk)
  await Promise.all(
    entries
      .filter(e => e.filePath)
      .map(async e => {
        const filePath = e.filePath as string;

        // Permanently skipped — browser-only code or previous import failure
        if (failedImports.has(filePath)) {
          return;
        }

        let component = componentCache.get(filePath);
        if (!component) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const mod = await import(filePath);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            component = (mod.default ?? mod) as FC;
            componentCache.set(filePath, component);
          } catch (err) {
            console.warn(
              `[SSR] Plugin "${e.keyName}" cannot be imported server-side, falling back to client rendering:`,
              (err as Error).message
            );
            failedImports.add(filePath);

            return;
          }
        }

        result[e.keyName] = { component, props: e.props };
      })
  );

  return result;
};

/** Drop the loaded-component and failed-import caches. These are keyed by absolute filePath, and a plugin
 *  rebuilt at the SAME version lands back on the same path — so without this, invalidating a plugin refreshes
 *  the build on disk while every render keeps serving the component imported before it. The plugin manager owns
 *  its own caches and cannot reach these, which is why invalidation has to clear both. */
export const invalidatePluginComponentCache = (): void => {
  componentCache.clear();
  failedImports.clear();
};
