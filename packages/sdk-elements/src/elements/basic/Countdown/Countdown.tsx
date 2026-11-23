import clsx from 'clsx';
import { use, useEffect, useRef, useState } from 'react';

import { InteractionsContext } from '@plitzi/sdk-interactions';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import {
  countdownDuration,
  countdownLabel,
  countdownParts,
  countdownTarget,
  nextCountdownTick
} from '@plitzi/sdk-shared/timeWindows';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import TimeWindowContext from '../../structure/TimeWindow/TimeWindowContext';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { CountdownLabels, CountdownUnit } from '@plitzi/sdk-shared/timeWindows';
import type { RefObject } from 'react';

export type CountdownProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  /**
   * The instant it counts to: ISO 8601 with the offset — `2026-12-01T09:00:00Z`. Empty, the end of the time window it
   * is in (`endsAt`), so the date is written once.
   */
  to?: string;
  /** The largest unit it says: what is left beyond it is said in it — 49 hours with `hours`. */
  largest?: CountdownUnit;
  /** The smallest unit it says, and how often it changes: every second, or every minute. */
  smallest?: CountdownUnit;
  /** Its units named in words (`days`), short (`d`, `hr`) or not at all — in the page's language and plural. */
  labels?: CountdownLabels;
  /** The language its units are named in (`es`, `pt-BR`). Empty, the space's (`settings.language`). */
  locale?: string;
};

/** Every unit below the largest is two figures — 02:05 — so the line does not jump as the numbers change. */
const figures = (amount: number, first: boolean): string => (first ? String(amount) : String(amount).padStart(2, '0'));

const Countdown = ({
  ref,
  className = '',
  to = '',
  largest = 'days',
  smallest = 'seconds',
  labels = 'long',
  locale = ''
}: CountdownProps) => {
  const {
    id,
    definition: { styleSelectors }
  } = useElement();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const around = use(TimeWindowContext);
  const [clock] = useCommonStore('clock');
  const [language] = useCommonStore('schema.settings.language');
  // The instant the server drew the page at, so it hydrates as drawn; the browser's own clock where none drew it.
  const [now, setNow] = useState(() => clock?.at ?? Date.now());
  const target = countdownTarget(to, around?.endsAt);

  // Once on the page, its own clock — or the instant the builder simulates, kept as it is.
  useEffect(() => {
    setNow(clock?.simulated ? clock.at : Date.now());
  }, [clock]);

  // And on to the next second (or minute) it changes at, until it is over.
  useEffect(() => {
    const next = target === undefined || clock?.simulated ? undefined : nextCountdownTick(now, target, smallest);
    if (next === undefined) {
      return undefined;
    }

    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()));

    return () => clearTimeout(timer);
  }, [clock, now, target, smallest]);

  // Its end, once per page it is on: reached while somebody watched, or already past when the page opened.
  const ended = target !== undefined && now >= target;
  const told = useRef(false);
  useEffect(() => {
    if (!ended || told.current || clock?.simulated || !id) {
      return;
    }

    told.current = true;
    void interactionsManager.interactionTrigger(id, 'onCountdownEnd', {});
  }, [ended, clock, id, interactionsManager]);

  const parts = countdownParts(now, target ?? now, largest, smallest);

  return (
    <RootElement
      tag="time"
      ref={ref}
      // A timer is never read aloud as it changes: a second a time would drown everything else.
      role="timer"
      dateTime={countdownDuration(parts)}
      className={clsx('plitzi-component__countdown', className)}
    >
      {parts.map(({ unit, amount }, index) => {
        const label = countdownLabel(unit, amount, labels, locale || language || 'en');

        return (
          <span key={unit} className={clsx('plitzi-component__countdown-unit', styleSelectors.unit)}>
            <span className={clsx('plitzi-component__countdown-value', styleSelectors.value)}>
              {figures(amount, index === 0)}
            </span>
            {label && <span className={clsx('plitzi-component__countdown-label', styleSelectors.label)}>{label}</span>}
          </span>
        );
      })}
    </RootElement>
  );
};

export default withElement(Countdown);

export { Countdown };
