import { watch } from 'node:fs';
import path from 'node:path';

import type { PluginManager } from './manager';
import type { FSWatcher } from 'node:fs';

/** How long a burst of writes — an editor saving, formatting, saving again — is waited out before one rebuild. */
const SETTLE_MS = 80;

/**
 * Calls `onChange(key)` when a file a built plugin was built from changes: what a development server rebuilds and
 * hands to the open pages (`devReload`), without restarting the process that serves them.
 *
 * The FOLDERS are watched, not the files. An editor that saves through a temporary file renames it over the old one,
 * and a watcher on the old file hears nothing after the first save. Which files matter comes from the build itself
 * (`PluginManager.onSources`), so a file one plugin imports from another's folder belongs to both.
 *
 * Returns the function that stops watching.
 */
export const watchPluginSources = (manager: PluginManager, onChange: (key: string) => void): (() => void) => {
  /** File → the plugins built from it. */
  const owners = new Map<string, Set<string>>();
  /** Plugin → the files it was built from, to take its claim back when a build names others. */
  const claims = new Map<string, readonly string[]>();
  const folders = new Map<string, FSWatcher>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const changed = (key: string) => {
    clearTimeout(pending.get(key));
    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        onChange(key);
      }, SETTLE_MS)
    );
  };

  const watchFolder = (folder: string) => {
    if (folders.has(folder)) {
      return;
    }

    try {
      const watcher = watch(folder, { persistent: false }, (_event, name) => {
        if (!name) {
          return;
        }

        owners.get(path.join(folder, name))?.forEach(changed);
      });
      // A folder removed while watched: nothing more to hear from it.
      watcher.on('error', () => {
        watcher.close();
        folders.delete(folder);
      });
      folders.set(folder, watcher);
    } catch {
      // A folder that is already gone; the next build says what it was built from now.
    }
  };

  const unwatchUnused = () => {
    const used = new Set([...owners.keys()].map(file => path.dirname(file)));
    folders.forEach((watcher, folder) => {
      if (!used.has(folder)) {
        watcher.close();
        folders.delete(folder);
      }
    });
  };

  const stopListening = manager.onSources((key, inputs) => {
    (claims.get(key) ?? []).forEach(file => {
      const keys = owners.get(file);
      keys?.delete(key);
      if (keys?.size === 0) {
        owners.delete(file);
      }
    });
    claims.set(key, inputs);
    inputs.forEach(file => {
      owners.set(file, (owners.get(file) ?? new Set()).add(key));
      watchFolder(path.dirname(file));
    });
    unwatchUnused();
  });

  return () => {
    stopListening();
    pending.forEach(timer => {
      clearTimeout(timer);
    });
    pending.clear();
    folders.forEach(watcher => {
      watcher.close();
    });
    folders.clear();
  };
};
