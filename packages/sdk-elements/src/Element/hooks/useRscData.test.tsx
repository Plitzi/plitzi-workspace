import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import useRscData from './useRscData';
import { elementEntry } from '../../testUtils/elementTestUtils';
import ElementContext from '../ElementContext';

import type { StoreApi } from '@plitzi/nexus';
import type { CommonState } from '@plitzi/sdk-shared';

/** The home page's list of boards, and a navigation to one of them — the order a navigation does things in. */
const HOME_ANSWER = { boards: ['one', 'two'] };

const makeStore = () =>
  createStore<CommonState>({
    schema: { pages: ['home', 'board'] },
    navigation: { currentPageId: 'home' },
    rsc: { enabled: true, loaded: true, location: '/', data: { gallery: HOME_ANSWER } }
  } as unknown as CommonState);

let seen: unknown[] = [];

const Probe = () => {
  const { elementData } = useRscData<{ boards: string[] }>();
  seen.push(elementData);

  return null;
};

const renderOn = (store: StoreApi<CommonState>, rootId: string) =>
  render(
    <StoreProvider store={store}>
      <ElementContext value={elementEntry('gallery', { rootId })}>
        <Probe />
      </ElementContext>
    </StoreProvider>
  );

const goTo = (path: string) => window.history.pushState({}, '', path);

describe('useRscData', () => {
  afterEach(() => {
    seen = [];
    goTo('/');
  });

  it('keeps what the page on its way out showed, while the payload is the destination’s', () => {
    goTo('/');
    const store = makeStore();
    renderOn(store, 'home');
    expect(seen.at(-1)).toEqual(HOME_ANSWER);

    // The destination's payload lands first, while the visitor is still here.
    act(() => {
      store.batch(() => {
        store.set('rsc.data', { board: { id: 'one' } });
        store.set('rsc.location', '/b/one');
      });
    });
    expect(seen.at(-1)).toEqual(HOME_ANSWER);

    // Then the route changes, and for a moment this page is still drawn under the next one's id.
    act(() => {
      goTo('/b/one');
      store.set('navigation.currentPageId', 'board');
    });
    expect(seen.at(-1)).toEqual(HOME_ANSWER);
    expect(seen).not.toContain(null);
  });

  it('shows a fresh answer for where it is, and nothing where the server answered nothing', () => {
    goTo('/');
    const store = makeStore();
    renderOn(store, 'home');

    act(() => {
      store.set('rsc.data', { gallery: { boards: ['three'] } });
    });
    expect(seen.at(-1)).toEqual({ boards: ['three'] });

    act(() => {
      store.set('rsc.data', {});
    });
    expect(seen.at(-1)).toBeNull();
  });

  it('never holds a layout’s element back: it is on every page', () => {
    goTo('/');
    const store = makeStore();
    renderOn(store, 'shell');

    act(() => {
      goTo('/b/one');
      store.batch(() => {
        store.set('navigation.currentPageId', 'board');
        store.set('rsc.location', '/b/one');
        store.set('rsc.data', { gallery: { boards: ['from the board page'] } });
      });
    });
    expect(seen.at(-1)).toEqual({ boards: ['from the board page'] });
  });
});
