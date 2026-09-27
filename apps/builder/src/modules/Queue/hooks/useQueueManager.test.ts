import { CombinedGraphQLErrors } from '@apollo/client/core';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';

import useQueueManager from './useQueueManager';

import type { UseQueueManagerProps } from './useQueueManager';
import type { Element, Schema } from '@plitzi/sdk-shared';

type Mutate = UseQueueManagerProps['mutate'];

const page: Element = {
  id: 'home',
  attributes: { name: 'Home' },
  definition: { label: 'Home', type: 'page', rootId: 'home', styleSelectors: { base: '' } }
};
const prevState = { flat: { home: page }, pages: ['home'] } as unknown as Schema;

/** One edit as the schema middleware queues it: what it did, the state before it, and the way to put that back. */
const edit = () => {
  const dispatch = vi.fn();
  const item = {
    action: { type: SchemaActions.SCHEMA_UPDATE_PAGE, page: { ...page, attributes: { name: 'Renamed' } } },
    prevState,
    state: prevState,
    dispatch
  };

  return { item, dispatch };
};

const refusal = () => ({
  success: false,
  error: new CombinedGraphQLErrors({
    errors: [{ message: 'This change would break the space', extensions: { code: 'SPACE_INTEGRITY' } }]
  })
});

const run = (mutate: Mutate, props: Partial<UseQueueManagerProps> = {}) =>
  renderHook(() => useQueueManager({ delay: 0, retryTimeout: 0, maxRetries: 2, mutate, ...props }));

const reverted = { type: SchemaActions.SCHEMA_UPDATE, schema: prevState, queryFailed: true };

describe('useQueueManager', () => {
  it('sends an edit, and keeps it once the server has stored it', async () => {
    const mutate = vi.fn(() => Promise.resolve({ success: true })) as unknown as Mutate;
    const { item, dispatch } = edit();
    const { result } = run(mutate);

    result.current.enqueue(item);

    await waitFor(() => expect(mutate).toHaveBeenCalledWith('SpaceUpdatePage', { page: item.action.page }));
    await waitFor(() => expect(result.current.processing).toBe(false));
    expect(dispatch).not.toHaveBeenCalled();
  });

  // The builder already shows the change. Left in place after the server refused it, the next save would build on a
  // state the server never had.
  it('takes back an edit the server refused, without asking again', async () => {
    const mutate = vi.fn(() => Promise.resolve(refusal())) as unknown as Mutate;
    const { item, dispatch } = edit();
    const { result } = run(mutate);

    result.current.enqueue(item);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(reverted));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('asks again when the server never answered, and takes the edit back if it still does not', async () => {
    const mutate = vi.fn(() =>
      Promise.resolve({ success: false, error: new Error('Network down') })
    ) as unknown as Mutate;
    const { item, dispatch } = edit();
    const { result } = run(mutate);

    result.current.enqueue(item);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(reverted));
    expect(mutate).toHaveBeenCalledTimes(3);
  });

  it('keeps an edit that got through on a second try', async () => {
    const mutate = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: new Error('Network down') })
      .mockResolvedValueOnce({ success: true }) as unknown as Mutate;
    const { item, dispatch } = edit();
    const { result } = run(mutate);

    result.current.enqueue(item);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.processing).toBe(false));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('sends nothing while disabled', async () => {
    const mutate = vi.fn() as unknown as Mutate;
    const { item } = edit();
    const { result } = run(mutate, { disabled: true });

    result.current.enqueue(item);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mutate).not.toHaveBeenCalled();
  });
});
