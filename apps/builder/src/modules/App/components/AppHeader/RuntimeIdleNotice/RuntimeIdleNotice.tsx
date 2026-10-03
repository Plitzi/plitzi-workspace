import clsx from 'clsx';
import { memo, useCallback, useEffect, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import timeLeftOf from './timeLeftOf';

/**
 * How soon before a runtime stops for being unused the header says so: a day, for an idle time counted in days — ten
 * minutes would warn nobody, since whoever left it unused for a week is rarely in the builder in those ten.
 */
const WARN_SECONDS = 24 * 60 * 60;

/** How often the header reads the runtime again: a countdown in minutes stays near enough to the truth. */
const READ_EVERY_MS = 30_000;

const READ = { refreshInterval: READ_EVERY_MS };

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * In the header, while a runtime of the space is about to stop for being unused: how soon, and keeping it running — so
 * somebody testing their space is not caught by its runtime stopping under them. Nothing otherwise.
 */
const RuntimeIdleNotice = () => {
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const { data, mutate } = useGraphQL('SpaceRuntime', data => data?.SpaceRuntime, undefined, READ);
  const [keeping, setKeeping] = useState(false);
  // The clock, read on a timer rather than while rendering: what the countdown is counted from.
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    const tick = setInterval(() => setNow(nowSeconds()), READ_EVERY_MS);

    return () => clearInterval(tick);
  }, []);
  const closing = data?.environments.find(
    runtime => runtime.status === 'ready' && runtime.idleStopsAt !== null && runtime.idleStopsAt - now <= WARN_SECONDS
  );

  const handleKeep = useCallback(async () => {
    if (!closing) {
      return;
    }

    setKeeping(true);
    await mutateNetwork('SpaceStartRuntime', { environment: closing.environment });
    await mutate();
    setKeeping(false);
  }, [closing, mutate, mutateNetwork]);

  if (!closing?.idleStopsAt) {
    return null;
  }

  return (
    <button
      id="header-runtime-idle"
      type="button"
      title={`Nothing has used the ${closing.environment} runtime for a while: it stops by itself to spend nothing. Keep it running for longer.`}
      className={clsx(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-xs text-amber-600 transition-colors select-none',
        'hover:bg-zinc-100 dark:text-amber-400 dark:hover:bg-zinc-800'
      )}
      disabled={keeping}
      onClick={handleKeep}
    >
      <i className="fa-solid fa-power-off text-[10px]" />
      <span className="font-medium">
        {keeping ? 'Keeping it running…' : `Runtime stops in ${timeLeftOf(closing.idleStopsAt - now)} · Keep running`}
      </span>
    </button>
  );
};

export default memo(RuntimeIdleNotice);
