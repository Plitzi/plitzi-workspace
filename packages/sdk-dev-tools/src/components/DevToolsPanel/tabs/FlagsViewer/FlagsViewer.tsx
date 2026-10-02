import { useCallback } from 'react';

import { withForcedFlag, writeForcedFlags } from '@plitzi/sdk-shared/flags';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import FlagsListItem from './FlagsListItem';

const NONE: Record<string, boolean> = {};

/**
 * The space's feature flags as this page resolved them — which layer decided each, and which rule matched — with a
 * way to force any of them for this browser.
 *
 * Forcing is the `qa` layer: the strongest there is, written to the page that is open and to a cookie, so the next
 * page this browser asks for is drawn with it on the server too. It is only ever offered here, and the dev tools are
 * only ever shown where debugging is authorized — the same rule the server applies before honouring the cookie.
 */
const FlagsViewer = () => {
  const [[declared, resolved]] = useCommonStore(['schema.flags', 'flags.resolved']);
  const [forced = NONE, setForced] = useCommonStore('flags.overrides.qa');
  const names = Object.keys(declared ?? {});

  const handleForce = useCallback(
    (name: string, value: boolean | undefined) => {
      const next = withForcedFlag(forced, name, value);
      setForced(next);
      writeForcedFlags(window.location.host, next);
    },
    [forced, setForced]
  );

  const handleClearAll = useCallback(() => {
    setForced({});
    writeForcedFlags(window.location.host, {});
  }, [setForced]);

  if (!declared || names.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-zinc-400 italic dark:text-zinc-600">
        This space declares no feature flags
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
        <span className="flex items-center gap-2">
          <i className="fa-solid fa-flag" />
          Feature Flags
        </span>
        {Object.keys(forced).length > 0 && (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 font-medium normal-case hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={handleClearAll}
          >
            Stop forcing all
          </button>
        )}
      </div>
      <div className="w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
        {names.map(name => (
          <FlagsListItem
            key={name}
            name={name}
            flag={declared[name]}
            resolution={resolved?.[name]}
            forced={forced[name]}
            onForce={handleForce}
          />
        ))}
      </div>
    </div>
  );
};

export default FlagsViewer;
