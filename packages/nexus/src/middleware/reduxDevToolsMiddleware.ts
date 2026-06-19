import { isDisabled } from './isDisabled';

import type { MiddlewareOptions, StoreChange, StoreMiddleware } from '../types';

// The slice of the Redux DevTools extension protocol this middleware uses. Typed locally so the package needs no
// extension typings — the extension is feature-detected at runtime and everything is a no-op without it.
type DevToolsConnection = {
  init: (state: unknown) => void;
  send: (action: { type: string }, state: unknown) => void;
  subscribe: (listener: (message: DevToolsMessage) => void) => () => void;
};

type DevToolsMessage = {
  type: string;
  state?: string;
  payload?: { type?: string };
};

type DevToolsExtension = {
  connect: (options?: { name?: string }) => DevToolsConnection;
};

export type ReduxDevToolsOptions<TState extends object> = MiddlewareOptions<TState> & {
  // Instance name shown in the DevTools dropdown. Defaults to `nexus`.
  name?: string;
  // Labels each committed change as an action; defaults to the changed path (`SET_STATE` for a whole-state write).
  action?: (change: StoreChange<TState>) => string;
};

const getExtension = (): DevToolsExtension | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: DevToolsExtension }).__REDUX_DEVTOOLS_EXTENSION__;
};

// Mirrors the store to the Redux DevTools browser extension: every committed change becomes an action (labelled by
// the changed path) and time-travel from the DevTools UI (jump / rollback) is reflected back into the store. A no-op
// when the extension isn't installed (production, SSR, browsers without it), so it's safe to leave wired in. Intended
// for the root store; like persist/history it's per-store and not cascaded.
export const reduxDevToolsMiddleware = <TState extends object>(
  options: ReduxDevToolsOptions<TState> = {}
): StoreMiddleware<TState> => {
  const { enabled } = options;

  return api => {
    if (isDisabled(enabled, api.getState())) {
      return;
    }

    const extension = getExtension();
    if (!extension) {
      return;
    }

    const { name = 'nexus', action } = options;
    const connection = extension.connect({ name });
    connection.init(api.getState());

    // While we apply a state the DevTools UI jumped to, suppress the echo so it isn't re-sent as a fresh action.
    let applyingDevToolsState = false;

    connection.subscribe(message => {
      if (message.type !== 'DISPATCH' || message.state === undefined) {
        return;
      }

      const dispatchType = message.payload?.type;
      if (dispatchType !== 'JUMP_TO_STATE' && dispatchType !== 'JUMP_TO_ACTION' && dispatchType !== 'ROLLBACK') {
        return;
      }

      applyingDevToolsState = true;
      try {
        api.setState(undefined, JSON.parse(message.state) as TState);
      } finally {
        applyingDevToolsState = false;
      }
    });

    return {
      onChange: change => {
        if (applyingDevToolsState) {
          return;
        }

        connection.send({ type: action ? action(change) : (change.path ?? 'SET_STATE') }, api.getState());
      }
    };
  };
};
