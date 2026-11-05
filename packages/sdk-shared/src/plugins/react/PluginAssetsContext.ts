import { sharedContext } from '../../react/sharedContext';

import type { PluginAssetsContextValue } from '../../types';

/**
 * The stylesheets the space's plugins and elements registered, apart from `PluginsContext`.
 *
 * They change as the page mounts — every element with styles of its own registers them from an effect — and every
 * container reads `PluginsContext` for the plugins it draws. Kept together, each registration was a new value of the
 * one context every container reads: a landing page was drawn whole twice more, in one task each, right after it
 * hydrated. What paints them (the document's head, a canvas) reads this one.
 */
const PluginAssetsContext = sharedContext<PluginAssetsContextValue>('PluginAssetsContext', { assets: {} });

export default PluginAssetsContext;
