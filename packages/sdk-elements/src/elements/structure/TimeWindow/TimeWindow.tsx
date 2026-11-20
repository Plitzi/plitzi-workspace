import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';
import { isWindowOpen, nextWindowChange } from '@plitzi/sdk-shared/timeWindows';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type TimeWindowProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /** When it starts showing what it holds: ISO 8601 with the offset — `2026-12-01T09:00:00Z`. Empty, it has started. */
  startsAt?: string;
  /** When it stops: the same, `2026-12-08T09:00:00Z`. Empty, it never ends. */
  endsAt?: string;
};

/** The longest a browser waits on one timer: more, and it fires at once. */
const LONGEST_WAIT_MS = 2 ** 31 - 1;

const TimeWindow = ({ ref, className = '', children, startsAt = '', endsAt = '' }: TimeWindowProps) => {
  const [clock] = useCommonStore('clock');
  const { builder, previewMode } = useRenderSettings();
  // The instant the server drew the page at, so it hydrates as drawn; the browser's own clock where none drew it.
  const [now, setNow] = useState(() => clock?.at ?? Date.now());

  // Once on the page, its own clock — or the instant the builder simulates, kept as it is.
  useEffect(() => {
    setNow(clock?.simulated ? clock.at : Date.now());
  }, [clock]);

  // And shown or hidden when the window opens or closes, while the page is open.
  useEffect(() => {
    const next = clock?.simulated ? undefined : nextWindowChange(now, startsAt, endsAt);
    if (next === undefined) {
      return undefined;
    }

    const timer = setTimeout(() => setNow(Date.now()), Math.min(LONGEST_WAIT_MS, Math.max(0, next - Date.now())));

    return () => clearTimeout(timer);
  }, [clock, startsAt, endsAt, now]);

  // Editing in the builder, what it holds is always there to edit; its preview shows it at the instant simulated.
  const open = (builder && !previewMode) || isWindowOpen(now, startsAt, endsAt);

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__time-window', className)}>
      {open && children}
    </RootElement>
  );
};

export default withElement(TimeWindow);

export { TimeWindow };
