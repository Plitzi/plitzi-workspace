import type { PluginEntry } from '../types';
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
): Promise<Record<string, FC>> => {
  const result: Record<string, FC> = {};

  // Merge component-source plugins provided directly by the PluginManager
  if (inlineComponents) {
    for (const [key, component] of Object.entries(inlineComponents)) {
      result[key] = component as FC;
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

        result[e.keyName] = component;
      })
  );

  return result;
};

/** Removes one or all entries from the component and failed-import caches. Call after plugin rebuild. */
export const invalidatePluginComponentCache = (filePath?: string): void => {
  if (filePath) {
    componentCache.delete(filePath);
    failedImports.delete(filePath);
  } else {
    componentCache.clear();
    failedImports.clear();
  }
};
