import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { InteractionsContext } from '@plitzi/sdk-interactions';

import { Countdown } from './Countdown';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';
import TimeWindowContext from '../../structure/TimeWindow/TimeWindowContext';

import type { CountdownProps } from './Countdown';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

const DEC_1 = Date.UTC(2026, 11, 1, 9);
const LEFT = 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000;

const interactionTrigger = vi.fn(() => Promise.resolve());
// A fake of the manager a page holds, with the one method a countdown calls: a cast, as the rest is never read.
const interactions = { interactionsManager: { interactionTrigger } } as unknown as InteractionsContextValue;

const entry = elementEntry('launch', {
  plitziJsxSkipHOC: true,
  definition: { rootId: 'root', label: 'Countdown', type: 'countdown', styleSelectors: { base: '' } }
});

/** The countdown on a page the server drew at `at`, in a space written in `language`, maybe inside a time window. */
const drawn = (props: CountdownProps, { at = DEC_1 - LEFT, language = 'en', endsAt = '', simulated = false } = {}) =>
  render(
    <StoreProvider value={{ clock: { at, simulated }, schema: { settings: { language } } }}>
      <InteractionsContext value={interactions}>
        <ElementContext value={entry}>
          <TimeWindowContext value={endsAt ? { endsAt } : undefined}>
            <Countdown {...props} />
          </TimeWindowContext>
        </ElementContext>
      </InteractionsContext>
    </StoreProvider>
  ).container;

const said = (container: HTMLElement) =>
  [...container.querySelectorAll('.plitzi-component__countdown-unit')].map(unit => unit.textContent);

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DEC_1 - LEFT);
    interactionTrigger.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says what is left in each unit as a timer, named in the space’s language', () => {
    const container = drawn({ to: '2026-12-01T09:00:00Z' }, { language: 'es' });
    const time = container.querySelector('time');

    expect(said(container)).toEqual(['2días', '03horas', '04minutos', '05segundos']);
    expect(time?.getAttribute('role')).toBe('timer');
    expect(time?.getAttribute('datetime')).toBe('P2DT3H4M5S');
  });

  it('counts to the end of the time window around it when it names no instant', () => {
    const container = drawn(
      { largest: 'hours', smallest: 'minutes', labels: 'none' },
      { endsAt: '2026-12-01T09:00:00Z' }
    );

    expect(said(container)).toEqual(['51', '05']);
  });

  it('counts on every second, and runs its flow once at zero', () => {
    const container = drawn({ to: '2026-12-01T09:00:00Z', largest: 'seconds', labels: 'none' }, { at: DEC_1 - 2000 });
    vi.setSystemTime(DEC_1 - 2000);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(said(container)).toEqual(['1']);
    expect(interactionTrigger).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(said(container)).toEqual(['0']);
    expect(interactionTrigger).toHaveBeenCalledTimes(1);
    expect(interactionTrigger).toHaveBeenCalledWith('launch', 'onCountdownEnd', {});
  });

  it('stays at the instant the builder simulates, and runs no flow there', () => {
    const container = drawn({ to: '2026-12-01T09:00:00Z', labels: 'none' }, { at: DEC_1, simulated: true });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(said(container)).toEqual(['0', '00', '00', '00']);
    expect(interactionTrigger).not.toHaveBeenCalled();
  });
});
