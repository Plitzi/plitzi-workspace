import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import usePluginTrigger from './usePluginTrigger';

const { interactionTrigger, service } = vi.hoisted(() => ({
  interactionTrigger: vi.fn(),
  service: { previewMode: true }
}));

vi.mock('./useElement', () => ({ default: () => ({ id: 'seats' }) }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({
    settings: { previewMode: service.previewMode }
  })
}));

vi.mock('@plitzi/sdk-interactions/InteractionsContext', async () => {
  const { createContext } = await import('react');

  return { default: createContext({ interactionsManager: { interactionTrigger } }) };
});

const declaration = {
  triggers: {
    onPick: { action: 'onPick', preview: { seat: '', row: '' } },
    onClear: { action: 'onClear', preview: {} }
  }
};

beforeEach(() => {
  interactionTrigger.mockReset();
  service.previewMode = true;
});

describe('usePluginTrigger', () => {
  it('fires the declared event on the element, with what its flows read', () => {
    const { result } = renderHook(() => usePluginTrigger(declaration));

    result.current('onPick', { seat: 'B4', row: 'B' });
    result.current('onClear', {});

    expect(interactionTrigger.mock.calls).toEqual([
      ['seats', 'onPick', { seat: 'B4', row: 'B' }],
      ['seats', 'onClear', {}]
    ]);
  });

  it('fires nothing while the page is being edited, where no flow runs', () => {
    service.previewMode = false;
    const { result } = renderHook(() => usePluginTrigger(declaration));

    result.current('onPick', { seat: 'B4', row: 'B' });

    expect(interactionTrigger).not.toHaveBeenCalled();
  });
});
