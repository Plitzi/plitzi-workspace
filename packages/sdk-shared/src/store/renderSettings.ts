import { useMemo } from 'react';

import { useCommonStore } from './index';

import type { RenderSettings } from '../types';

/** The surface a schema renders on when nobody said otherwise: a live, non-debug space rendered in place. Each surface
 *  seeds `render` at its own store root with these plus whatever it actually is (the builder, for one, is not
 *  preview by default) — this is the floor, so no read site carries its own idea of the default. */
export const DEFAULT_RENDER_SETTINGS: Required<RenderSettings> = {
  previewMode: true,
  debugMode: false,
  renderMode: 'raw',
  environment: 'main',
  isHydrating: false,
  overQuota: false
};

/** Reads `render` from the nearest store, filled in. Returns every key defined, so call sites destructure without
 *  restating a default — and a tree that never seeded it (a standalone element, a test) still renders.
 *
 *  A nested scope that seeds `render` SHADOWS the whole slice — reads do not fall through key by key, whichever way
 *  they are written — so a subtree that overrides one flag must restate the rest ({@link useRenderOverride}). */
const useRenderSettings = (): Required<RenderSettings> => {
  const [[previewMode, debugMode, renderMode, environment, isHydrating, overQuota]] = useCommonStore([
    'render.previewMode',
    'render.debugMode',
    'render.renderMode',
    'render.environment',
    'render.isHydrating',
    'render.overQuota'
  ]);

  return useMemo(
    () => ({
      previewMode: previewMode ?? DEFAULT_RENDER_SETTINGS.previewMode,
      debugMode: debugMode ?? DEFAULT_RENDER_SETTINGS.debugMode,
      renderMode: renderMode ?? DEFAULT_RENDER_SETTINGS.renderMode,
      environment: environment ?? DEFAULT_RENDER_SETTINGS.environment,
      isHydrating: isHydrating ?? DEFAULT_RENDER_SETTINGS.isHydrating,
      overQuota: overQuota ?? DEFAULT_RENDER_SETTINGS.overQuota
    }),
    [previewMode, debugMode, renderMode, environment, isHydrating, overQuota]
  );
};

/** Builds the value for a `<StoreProvider>` that renders a subtree under different settings — the builder's preview
 *  pane being preview whatever the editor's own toggle says. Carries the surrounding settings over explicitly,
 *  because the scope shadows the slice: what an override leaves out is NOT inherited, it is lost.
 *
 *  `overrides` has to be referentially stable (a module-level constant), like any memo input. */
export const useRenderOverride = (overrides: RenderSettings) => {
  const settings = useRenderSettings();

  return useMemo(() => ({ render: { ...settings, ...overrides } }), [settings, overrides]);
};

export default useRenderSettings;
