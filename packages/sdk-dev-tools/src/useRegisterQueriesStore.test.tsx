// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getDevStoresSnapshot } from '@plitzi/nexus';
import { queryCache } from '@plitzi/sdk-shared/queries';

import useRegisterQueriesStore from './useRegisterQueriesStore';

// `Object.is` because the registry widens every store to one opaque shape, which `===` refuses to compare with a typed one.
const queriesEntry = () => getDevStoresSnapshot().find(entry => Object.is(entry.store, queryCache.store));

describe('useRegisterQueriesStore', () => {
  it('registers the query cache under the instance showing the panel, and removes it on unmount', () => {
    const { unmount } = renderHook(() => useRegisterQueriesStore(true, 'sdk-instance-1'));

    expect(queriesEntry()).toMatchObject({ scopeId: 'sdk-instance-1', name: 'Queries' });

    unmount();

    expect(queriesEntry()).toBeUndefined();
  });

  it('registers nothing while the panel is not the one shown', () => {
    renderHook(() => useRegisterQueriesStore(false, 'sdk-instance-1'));

    expect(queriesEntry()).toBeUndefined();
  });
});
