import { use, useEffect, useRef, useState } from 'react';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';

export type CountdownProps = {
  /** When it ends, in milliseconds since the epoch. 0 is no countdown. */
  endsAt?: number | string;
  /** How many seconds before the end it says so, as `data-state="ending"`. */
  warnSeconds?: number | string;
  /** Its last seconds, each told as it begins (`onTick`) — for a clock the room should hear. */
  tickSeconds?: number | string;
  className?: string;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

const TICK_MS = 250;

/** `4:05`, or with hours once there are any: `4:59:05`. */
const clock = (milliseconds: number): string => {
  const seconds = Math.ceil(milliseconds / 1000);
  const [hours, minutes] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60)];
  const tail = String(seconds % 60).padStart(2, '0');

  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`;
};

/**
 * The countdown. Rendered empty on the server — the time left is the browser's to say, a second after the page was
 * built it is already wrong — and ticking from the first frame in the browser.
 */
const Countdown = ({ endsAt = 0, warnSeconds = 10, tickSeconds = 0, className }: CountdownProps) => {
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const end = Number(endsAt) || 0;
  const [left, setLeft] = useState(0);
  const ended = useRef(end);
  const ticked = useRef(0);
  const ticks = Number(tickSeconds) || 0;

  useEffect(() => {
    if (!end) {
      setLeft(0);

      return undefined;
    }

    const tick = (): void => {
      const remaining = Math.max(0, end - Date.now());
      setLeft(remaining);
      const second = Math.ceil(remaining / 1000);
      if (second > 0 && second <= ticks && second !== ticked.current) {
        ticked.current = second;
        void interactionsManager.interactionTrigger(id, declaration.triggers.onTick.action, { left: second });
      }
      // Said once per countdown, and only for one this page watched run out — not for one already over on arrival.
      if (!remaining && ended.current !== end) {
        ended.current = end;
        void interactionsManager.interactionTrigger(id, declaration.triggers.onEnd.action, {});
      }
    };
    ended.current = end - Date.now() <= 0 ? end : 0;
    tick();
    const timer = setInterval(tick, TICK_MS);

    return () => clearInterval(timer);
  }, [end, id, interactionsManager, ticks]);

  const warning = (Number(warnSeconds) || 0) * 1000;
  const state = left > warning ? 'running' : left > 0 ? 'ending' : 'idle';

  return (
    <RootElement
      className={className}
      data-state={state}
      role="timer"
      interactionTriggers={TRIGGERS}
      interactionCallbacks={{}}
    >
      {left > 0 ? clock(left) : ''}
    </RootElement>
  );
};

export default Countdown;
