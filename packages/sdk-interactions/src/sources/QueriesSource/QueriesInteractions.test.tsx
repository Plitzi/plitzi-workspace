import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { invalidateQueries } from '@plitzi/sdk-shared/queries';

import QueriesInteractions from './QueriesInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/queries', () => ({ invalidateQueries: vi.fn(() => Promise.resolve()) }));

const mount = () => {
  let registered: { id?: string; callbacks: Record<string, InteractionCallback> } = { callbacks: {} };
  const interactions = {
    interactionsManager: {},
    useInteractions: (value: { id?: string; callbacks?: Record<string, InteractionCallback> }) => {
      registered = { id: value.id, callbacks: value.callbacks ?? {} };
    }
  } as unknown as InteractionsContextValue;

  render(
    <InteractionsContext value={interactions}>
      <QueriesInteractions />
    </InteractionsContext>
  );

  return registered;
};

describe('QueriesInteractions', () => {
  it('registers invalidateQueries under the queries source', () => {
    const { id, callbacks } = mount();

    expect(id).toBe('queries');
    expect(callbacks.invalidateQueries).toMatchObject({ action: 'invalidateQueries', type: 'globalCallback' });
  });

  it('invalidates by the URL prefix the step names, and everything without one', async () => {
    const { callbacks } = mount();
    const run = callbacks.invalidateQueries.callback as (params: Record<string, unknown>) => Promise<void>;

    await run({ url: '/api/orders' });
    expect(invalidateQueries).toHaveBeenLastCalledWith('/api/orders');

    await run({});
    expect(invalidateQueries).toHaveBeenLastCalledWith('');
  });
});
