import { PLUGIN_ROUTES_SEGMENT } from '@plitzi/sdk-shared/actions/functions';

/**
 * Whose code a function is when it is not the space's: a plugin's server half, which a plugin brings with it and a space
 * only chose to use.
 *
 * The space trusted the plugin to draw something, not with what it keeps — so a plugin's functions are handed a narrower
 * `ctx`: their own corner of the space's `kv` and rate limits, signatures that only verify as theirs, the hosts they
 * declared, and none of the space's credentials or realtime channels.
 */
export type FunctionScope = { plugin: string };

/** Where a plugin's routes answer, under `/fn`: `/fn/plugins/<type>/…`. */
export const PLUGIN_ROUTES = `/${PLUGIN_ROUTES_SEGMENT}/`;

/** A plugin's keys inside its space's `kv`: nothing of the space's, or of another plugin's, is reachable from it. */
export const pluginKvPrefix = (plugin: string): string => `plugin:${plugin}:`;

/**
 * What a plugin signs is signed as ITS: the value is bound to the plugin before the space's key sees it, so a plugin
 * cannot mint a value the space's own code — or another plugin — would accept as its own.
 */
export const pluginSigned = (plugin: string, value: string): string => `plugin:${plugin}\n${value}`;

/**
 * The plugin a route path addresses — `/plugins/board/layout` is `board`, with `/layout` left for its own routes — or
 * nothing for a path that is not a plugin's.
 */
export const pluginOfPath = (path: string): { plugin: string; path: string } | undefined => {
  const trimmed = `/${path.replace(/^\/+/, '')}`;
  if (!trimmed.startsWith(PLUGIN_ROUTES)) {
    return undefined;
  }

  const [plugin = '', ...rest] = trimmed.slice(PLUGIN_ROUTES.length).split('/');

  return plugin ? { plugin, path: `/${rest.join('/')}` } : undefined;
};

/** Why a plugin's task is refused: it is named after something else. */
export const pluginTaskProblem = (plugin: string, namespace: string, action: string): string =>
  `Task "${namespace}.${action}" of plugin "${plugin}": a plugin's tasks are named after it — namespace "${plugin}"`;
