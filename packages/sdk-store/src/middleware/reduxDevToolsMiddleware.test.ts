import { afterEach, describe, it, expect, vi } from 'vitest';

import { reduxDevToolsMiddleware } from './reduxDevToolsMiddleware';
import createStore from '../createStore/createStore';

type AppState = { count: number; ui: { open: boolean } };
const initial = (): AppState => ({ count: 0, ui: { open: false } });

type Listener = (message: { type: string; state?: string; payload?: { type?: string } }) => void;

const installExtension = () => {
  const init = vi.fn();
  const send = vi.fn();
  let listener: Listener | undefined;
  const connect = vi.fn(() => ({
    init,
    send,
    subscribe: (fn: Listener) => {
      listener = fn;

      return () => {
        listener = undefined;
      };
    }
  }));

  (window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ = { connect };

  return { connect, init, send, dispatch: (message: Parameters<Listener>[0]) => listener?.(message) };
};

afterEach(() => {
  delete (window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__;
});

describe('reduxDevToolsMiddleware', () => {
  it('connects and sends the initial state', () => {
    const ext = installExtension();
    createStore<AppState>(initial(), { middlewares: [reduxDevToolsMiddleware({ name: 'app' })] });

    expect(ext.connect).toHaveBeenCalledWith({ name: 'app' });
    expect(ext.init).toHaveBeenCalledWith({ count: 0, ui: { open: false } });
  });

  it('sends each committed change as an action labelled by path, with the next state', () => {
    const ext = installExtension();
    const store = createStore<AppState>(initial(), { middlewares: [reduxDevToolsMiddleware()] });

    store.setState('count', 1);
    store.setState('ui.open', true);

    expect(ext.send).toHaveBeenNthCalledWith(1, { type: 'count' }, { count: 1, ui: { open: false } });
    expect(ext.send).toHaveBeenNthCalledWith(2, { type: 'ui.open' }, { count: 1, ui: { open: true } });
  });

  it('labels a whole-state write SET_STATE by default', () => {
    const ext = installExtension();
    const store = createStore<AppState>(initial(), { middlewares: [reduxDevToolsMiddleware()] });

    store.setState(undefined, { count: 5, ui: { open: true } });

    expect(ext.send).toHaveBeenCalledWith({ type: 'SET_STATE' }, { count: 5, ui: { open: true } });
  });

  it('honours a custom action labeller', () => {
    const ext = installExtension();
    const store = createStore<AppState>(initial(), {
      middlewares: [reduxDevToolsMiddleware<AppState>({ action: change => `set:${change.path ?? 'root'}` })]
    });

    store.setState('count', 1);

    expect(ext.send).toHaveBeenCalledWith({ type: 'set:count' }, expect.anything());
  });

  it('applies a state the DevTools UI jumps to, without echoing it back', () => {
    const ext = installExtension();
    const store = createStore<AppState>(initial(), { middlewares: [reduxDevToolsMiddleware()] });

    ext.dispatch({
      type: 'DISPATCH',
      payload: { type: 'JUMP_TO_ACTION' },
      state: JSON.stringify({ count: 42, ui: { open: true } })
    });

    expect(store.getState()).toEqual({ count: 42, ui: { open: true } });
    expect(ext.send).not.toHaveBeenCalled();
  });

  it('ignores DISPATCH messages that carry no state', () => {
    const ext = installExtension();
    const store = createStore<AppState>(initial(), { middlewares: [reduxDevToolsMiddleware()] });

    ext.dispatch({ type: 'DISPATCH', payload: { type: 'PAUSE_RECORDING' } });

    expect(store.getState()).toEqual(initial());
  });

  it('is a no-op when the extension is not installed', () => {
    delete (window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__;

    expect(() => {
      const store = createStore<AppState>(initial(), { middlewares: [reduxDevToolsMiddleware()] });
      store.setState('count', 1);
    }).not.toThrow();
  });
});
