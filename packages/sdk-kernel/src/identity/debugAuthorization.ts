import type { Schema } from '@plitzi/sdk-shared';

type DebugConfig = { debugMode?: boolean; devMode?: boolean };

type DebugSettings = Pick<Schema['settings'], 'debugMode'> | undefined;

/**
 * Whether a page — and what its flows did — may be debugged. One rule for the render and for every run it reports.
 *
 * The server decides first, through `debugMode`: set, it speaks for every space, and `false` is a refusal no space can
 * turn around. Left unset, a development server authorizes it, and so does a space whose own settings switched
 * `debugMode` on. The settings are what this server loaded, never anything the request carries.
 *
 * A page nobody authorized is told nothing: not the steps behind it, not even that a flow ran.
 */
export const authorizesDebugging = (config: DebugConfig, settings: DebugSettings): boolean =>
  config.debugMode ?? (config.devMode === true || settings?.debugMode === true);

/**
 * The same rule, for a request that has not loaded the space yet.
 *
 * The settings are read only when the server left the answer to the space. A space that cannot be read authorizes
 * nothing: debugging is the one thing about a page that fails closed.
 */
export const resolveDebugAuthorization = async (
  config: DebugConfig,
  loadSettings: () => Promise<DebugSettings>
): Promise<boolean> => {
  if (config.debugMode !== undefined || config.devMode === true) {
    return authorizesDebugging(config, undefined);
  }

  try {
    return authorizesDebugging(config, await loadSettings());
  } catch {
    return false;
  }
};
