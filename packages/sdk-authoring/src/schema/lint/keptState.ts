import type { LintContext } from './context';

/**
 * What a space says to keep of its state that does nothing, said: a list of keys under `settings.transientState`,
 * `keptState`, `paintedState` or `browserState` while `settings.keepState` is off — nothing is kept in the first place.
 * Read off the settings, so the builder says it as authoring does.
 */
export const lintKeptState = (ctx: LintContext): void => {
  const settings: Record<string, unknown> = ctx.schema.settings;
  if (settings.keepState === true) {
    return;
  }

  const listed = (key: string): unknown[] | undefined => {
    const keys = settings[key];

    return Array.isArray(keys) && keys.length > 0 ? keys : undefined;
  };

  const transient = listed('transientState');
  if (transient) {
    ctx.warn(
      'transient-state-without-keep-state',
      '`settings.transientState` names keys never to keep, but `settings.keepState` is not on — nothing is kept in the first place, so it does nothing. Turn `keepState` on, or remove `transientState`.',
      undefined,
      { keys: transient }
    );
  }

  const kept = listed('keptState');
  if (kept) {
    ctx.warn(
      'kept-state-without-keep-state',
      '`settings.keptState` names the keys to keep, but `settings.keepState` is not on — nothing is kept, so it does nothing. Turn `keepState` on, or remove `keptState`.',
      undefined,
      { keys: kept }
    );
  }

  const painted = listed('paintedState');
  if (painted) {
    ctx.warn(
      'painted-state-without-keep-state',
      '`settings.paintedState` names kept keys for the server to draw with, but `settings.keepState` is not on — nothing is kept, so there is nothing to draw with. Turn `keepState` on, or remove `paintedState`.',
      undefined,
      { keys: painted }
    );
  }

  const browser = listed('browserState');
  if (browser) {
    ctx.warn(
      'browser-state-without-keep-state',
      '`settings.browserState` names kept keys the browser keeps whoever signs in, but `settings.keepState` is not on — nothing is kept, so it does nothing. Turn `keepState` on, or remove `browserState`.',
      undefined,
      { keys: browser }
    );
  }
};
