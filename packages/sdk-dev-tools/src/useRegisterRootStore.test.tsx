// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createStore, getDevStoresSnapshot } from '@plitzi/nexus';
import { StoreContext } from '@plitzi/nexus/react';

import useRegisterRootStore from './useRegisterRootStore';

import type { ReactNode } from 'react';

vi.mock('@plitzi/nexus/env', () => ({ MODE: 'production', isProd: true, isDev: false, isTest: false }));

// Typed as the registry's own store shape, so an entry's store and this one compare as the same kind of thing.
const rootStore = createStore<Record<string, unknown>>(() => ({ page: 'home' }));

// The store handed in through context alone, with no `StoreProvider`, so nexus's own registration never runs and
// whatever reaches the registry was put there by the hook.
const wrapper = ({ children }: { children: ReactNode }) => <StoreContext value={rootStore}>{children}</StoreContext>;

const rootEntry = () => getDevStoresSnapshot().find(entry => entry.store === rootStore);

describe('useRegisterRootStore, in a production build', () => {
  it('registers the store it sits in, untagged, and removes it on unmount', () => {
    const { unmount } = renderHook(() => useRegisterRootStore(true), { wrapper });

    expect(rootEntry()).toBeDefined();
    expect(rootEntry()?.scopeId).toBeUndefined();

    unmount();

    expect(rootEntry()).toBeUndefined();
  });

  it('registers nothing while the panel is disabled', () => {
    const { unmount } = renderHook(() => useRegisterRootStore(false), { wrapper });

    expect(rootEntry()).toBeUndefined();

    unmount();
  });
});
