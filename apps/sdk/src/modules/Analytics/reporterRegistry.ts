import type { Reporter } from './createReporter';

/**
 * The live reporter, held outside React.
 *
 * `plitzi.track(...)` is called from a host page, an interaction callback, a plugin — places with no access
 * to a hook and no component to hang one off. This is the same shape `getStateManager()` and
 * `getEventBridge()` already use for exactly that reason: one render owns the instance, everyone else reaches
 * it by name.
 */
let current: Reporter | undefined;

export const setReporter = (reporter: Reporter | undefined): void => {
  current = reporter;
};

export const getReporter = (): Reporter | undefined => current;

/** Reports a named interaction. A no-op when this render reports nothing (an offline export, an embedded
 *  widget, a deployment with no collector configured) — never an error a page has to guard against. */
export const track = (name: string, props?: Record<string, string | number | boolean>): void => {
  current?.track(name, props);
};
