import { act, render } from '@testing-library/react';
import { use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { StyleVariableCategory } from '@plitzi/sdk-shared/types';

import BuilderStyleContextProvider from './BuilderStyleContextProvider';
import StyleContext from '../StyleContext';
import { StyleActions } from '../StyleReducer';

import type { BuilderStyleMiddleware } from './BuilderStyleContextProvider';
import type { StyleReducerActions } from '../StyleReducer';
import type { Style, StyleContextValue } from '@plitzi/sdk-shared';

/** The builder's live stream, as the provider registers on it: one listener per event, called as a collaborator's edit. */
const stream = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();

  return {
    listeners,
    unsubscribed: [] as string[],
    publish: (event: string, payload: unknown) => listeners.get(event)?.(payload)
  };
});

vi.mock('@plitzi/sdk-shared/network/react', async () => {
  const { createContext } = await import('react');

  return {
    NetworkContext: createContext({
      subscriptionManager: {
        subscribe: (event: string, callback: (payload: unknown) => void) => {
          stream.listeners.set(event, callback);

          return () => undefined;
        },
        unsubscribe: (events: string[]) => {
          stream.unsubscribed.push(...events);
          events.forEach(event => stream.listeners.delete(event));
        }
      }
    })
  };
});

const bridge = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/sdk-event-bridge', () => ({ useEventBridge: bridge }));

let events: StyleContextValue = {};

/** The context types every event `unknown` (`StyleContextValue`): one is called as the builder calls it, by name. */
const send = (event: keyof StyleContextValue, ...args: unknown[]) => {
  const handler = events[event];
  if (typeof handler !== 'function') {
    throw new Error(`The style context gave no ${event}`);
  }

  Reflect.apply(handler, undefined, args);
};

const Events = () => {
  events = use(StyleContext);

  return null;
};

const builder = (props: { includeSubscriptions?: boolean; middlewares?: BuilderStyleMiddleware[] } = {}) => {
  const store = createStore<{ style?: Style }>({});
  const view = render(
    <StoreProvider store={store}>
      <BuilderStyleContextProvider {...props}>
        <Events />
      </BuilderStyleContextProvider>
    </StoreProvider>
  );

  return { store, ...view };
};

beforeEach(() => {
  stream.listeners.clear();
  stream.unsubscribed.length = 0;
  bridge.mockClear();
  events = {};
});

describe('BuilderStyleContextProvider', () => {
  it('keeps the style in the common store as it is edited', () => {
    const { store } = builder();

    act(() => {
      send('styleAddVariable', StyleVariableCategory.SPACING, 'gap', '8px');
    });

    expect(store.get('style')?.variables.spacing?.gap).toBe('8px');
  });

  it('applies a collaborator’s edit from the stream, and says it came from there', () => {
    const seen: StyleReducerActions[] = [];
    const { store } = builder({
      middlewares: [{ middleware: (_prev, _next, _dispatch, action) => seen.push(action) }]
    });

    act(() => {
      stream.publish('STYLE_ADD_VARIABLE', { category: StyleVariableCategory.SPACING, name: 'gutter', value: '16px' });
    });

    expect(store.get('style')?.variables.spacing?.gutter).toBe('16px');
    expect(seen).toEqual([expect.objectContaining({ type: StyleActions.STYLE_ADD_VARIABLE, fromSubscriptions: true })]);

    act(() => {
      send('styleRemoveVariable', StyleVariableCategory.SPACING, 'gutter');
    });

    expect(seen[1]).toMatchObject({ type: StyleActions.STYLE_REMOVE_VARIABLE, fromSubscriptions: false });
    // Its last variable gone, the category goes with it.
    expect(store.get('style')?.variables).not.toHaveProperty('spacing');
  });

  it('listens to every style event of the stream, and lets them all go when it unmounts', () => {
    const { unmount } = builder();
    const listened = [...stream.listeners.keys()];

    expect(listened).toHaveLength(15);

    unmount();

    expect(stream.unsubscribed.sort()).toEqual(listened.sort());
  });

  it('listens to nothing where it is told not to', () => {
    builder({ includeSubscriptions: false });

    expect(stream.listeners.size).toBe(0);
  });

  it('hands every event to the builder’s bridge', () => {
    builder();

    expect(bridge).toHaveBeenCalledWith('main', events);
  });

  it('gives a selector added with no name one of its own', () => {
    const seen: StyleReducerActions[] = [];
    builder({ middlewares: [{ middleware: (_prev, _next, _dispatch, action) => seen.push(action) }] });

    act(() => {
      send('styleAddSelector', 'desktop', '', 'class', undefined, { color: 'red' }, {});
    });

    expect(seen[0]).toMatchObject({ type: StyleActions.STYLE_ADD_SELECTOR, selectorType: 'class' });
    expect(seen[0]).toHaveProperty('selector', expect.stringMatching(/\S/));
  });

  it('routes each stream event to its own action', () => {
    const seen: StyleReducerActions[] = [];
    builder({ middlewares: [{ middleware: (_prev, _next, _dispatch, action) => seen.push(action) }] });
    const font = { family: 'Inter', variants: ['400'] };
    const sent: [string, unknown, StyleReducerActions['type']][] = [
      ['STYLE_UPDATED', {}, StyleActions.STYLE_UPDATE],
      ['STYLE_UPDATE_VARIABLE', { category: 'spacing', name: 'gap', value: '4px' }, StyleActions.STYLE_UPDATE_VARIABLE],
      ['STYLE_REMOVE_SELECTOR', { displayMode: 'desktop', selector: 'x' }, StyleActions.STYLE_REMOVE_SELECTOR],
      ['STYLE_REMOVE_SELECTORS', { displayMode: 'desktop', selectors: ['x'] }, StyleActions.STYLE_REMOVE_SELECTORS],
      ['STYLE_ADD_FONT', { font }, StyleActions.STYLE_ADD_FONT],
      ['STYLE_UPDATE_FONT', { family: 'Inter', font }, StyleActions.STYLE_UPDATE_FONT],
      ['STYLE_REMOVE_FONT', { family: 'Inter' }, StyleActions.STYLE_REMOVE_FONT],
      ['STYLE_UPDATE_SETTINGS', { path: 'mode', value: 'mobile-first' }, StyleActions.STYLE_UPDATE_SETTINGS]
    ];

    act(() => {
      sent.forEach(([event, payload]) => stream.publish(event, payload));
    });

    expect(seen.map(action => action.type)).toEqual(sent.map(([, , type]) => type));
    expect(seen.every(action => action.fromSubscriptions)).toBe(true);
  });
});
