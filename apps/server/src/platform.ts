/**
 * Pages and actions in one process: `createPlatform` builds the actions engine and hands it to the page server (docs/en/server-packages.md,
 * D11). Its own entry so a page server deployed on its own never loads the engine to find out it has none.
 */
export { createPlatform } from './core/platform';

export type { PlatformConfig } from './core/platform';
