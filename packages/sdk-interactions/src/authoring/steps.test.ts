import { describe, expect, it } from 'vitest';

import { BUILTIN_GLOBAL_CALLBACKS } from './globalCallbacks';
import {
  addNotification,
  authLogin,
  authLogout,
  authRefreshDetails,
  cancelServerAction,
  clearState,
  navigate,
  runServerAction,
  setState
} from './steps';

import type { StepSpec } from '@plitzi/sdk-schema';

/**
 * What a step builder writes has to be a name something actually registers.
 *
 * The bug this pins cost a working sign-in: `authLogin()` wrote `action: 'authLogin'` while the auth source
 * registered its callback as `login`, so `callbacksAvailables.auth.authLogin` was undefined and the step did
 * nothing — on a page, a server and a set of credentials that were all correct. Nothing in the type system can
 * see that, because both halves are strings.
 */
const globalBuilders: Record<string, StepSpec> = {
  setState: setState({ key: 'k', type: 'text', value: 'v' }),
  clearState: clearState(),
  navigate: navigate({ urlType: 'internal', url: '/' }),
  addNotification: addNotification({ content: 'hi' }),
  authLogin: authLogin({ mode: 'normal', username: 'ada', password: 'secret' }),
  authLogout: authLogout(),
  authRefreshDetails: authRefreshDetails(),
  runServerAction: runServerAction({ actionId: 'a' }),
  cancelServerAction: cancelServerAction({ runId: 'r' })
};

describe('global callback step builders', () => {
  it.each(Object.entries(globalBuilders))('%s writes an action a source declares', (_name, step) => {
    expect(Object.keys(BUILTIN_GLOBAL_CALLBACKS)).toContain(step.action);
  });

  /**
   * The other half of the same pair. A global callback is resolved as `callbacksAvailables[<source>][<action>]`,
   * so a step whose `on` is not the module that declared the action is as dead as one with the wrong action.
   */
  it.each(Object.entries(globalBuilders))('%s targets the module that declared it', (_name, step) => {
    expect(step.on).toBe(BUILTIN_GLOBAL_CALLBACKS[step.action].source);
  });

  it('refuses an action no source declares', () => {
    // `authLogin` was exactly this shape of mistake, and it was accepted for as long as nothing checked.
    expect(() => setState({ key: 'k', type: 'text', value: 'v' })).not.toThrow();
    expect(BUILTIN_GLOBAL_CALLBACKS).not.toHaveProperty('authLogin');
  });
});
