import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { TimeWindow } from './TimeWindow';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../tests/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

const FROM = '2026-12-01T09:00:00Z';
const UNTIL = '2026-12-08T09:00:00Z';
const OPENS = Date.UTC(2026, 11, 1, 9);

const drawn = (store: Record<string, unknown>) =>
  render(
    <StoreProvider value={store}>
      <ElementContext value={skipHocEntry('sale')}>
        <TimeWindow startsAt={FROM} endsAt={UNTIL}>
          <p>Sale on</p>
        </TimeWindow>
      </ElementContext>
    </StoreProvider>
  );

describe('TimeWindow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows what it holds only inside its window, at the instant the builder simulates', () => {
    const { unmount } = drawn({ clock: { at: OPENS + 1000, simulated: true } });
    expect(screen.getByText('Sale on')).toBeTruthy();
    unmount();

    drawn({ clock: { at: OPENS - 1000, simulated: true } });
    expect(screen.queryByText('Sale on')).toBeNull();
  });

  it('always shows it while editing in the builder', () => {
    drawn({ clock: { at: OPENS - 1000, simulated: true }, render: { builder: true, previewMode: false } });

    expect(screen.getByText('Sale on')).toBeTruthy();
  });

  it('opens on an open page when its start comes', () => {
    vi.useFakeTimers({ now: OPENS - 5000 });
    drawn({});
    expect(screen.queryByText('Sale on')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Sale on')).toBeTruthy();
  });
});
