import clsx from 'clsx';
import { use, useCallback, useMemo } from 'react';

import DevToolsContext from '@plitzi/sdk-shared/devTools/DevToolsContext';

import type { LogType } from '@plitzi/sdk-shared';

export type DevToolsIndicatorProps = {
  className?: string;
  onOpen: (logType?: LogType) => void;
};

// Fixed to the viewport rather than docked: while the panel is collapsed this is the only thing the dev tools show,
// and it has to stay reachable over a page that scrolls. It wears the same chrome as the "Made in Plitzi" badge
// (.made-in-plitzi in the SDK stylesheet) — restated in Tailwind because that class lives in the page's stylesheet
// and this renders inside the dev-tools shadow root — sitting in the opposite corner, above it in z-order.
const DevToolsIndicator = ({ className, onOpen }: DevToolsIndicatorProps) => {
  const { logs } = use(DevToolsContext);

  const { errors, warnings } = useMemo(
    () =>
      logs.reduce(
        (acum, { logType }) => ({
          errors: logType === 'danger' ? acum.errors + 1 : acum.errors,
          warnings: logType === 'warning' ? acum.warnings + 1 : acum.warnings
        }),
        { errors: 0, warnings: 0 }
      ),
    [logs]
  );

  // Opening straight into what the badge is complaining about: errors first, then warnings, and the plain log list
  // when there is nothing wrong.
  const handleClick = useCallback(() => {
    if (errors > 0) {
      onOpen('danger');

      return;
    }

    if (warnings > 0) {
      onOpen('warning');

      return;
    }

    onOpen();
  }, [errors, warnings, onOpen]);

  return (
    <div className={clsx('fixed bottom-3 left-3 z-[1000000]', className)}>
      <button
        className={clsx(
          'flex cursor-pointer items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-[12px]/[16px]',
          'font-bold text-zinc-600 shadow-md transition-colors select-none hover:bg-zinc-50',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        )}
        title="Plitzi dev tools"
        onClick={handleClick}
      >
        Plitzi
        {errors > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <i className="fa-regular fa-circle-xmark text-[11px]" />
            {errors}
          </span>
        )}
        {warnings > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-triangle-exclamation text-[11px]" />
            {warnings}
          </span>
        )}
        {errors === 0 && warnings === 0 && <i className="fa-solid fa-terminal text-[11px] text-zinc-400" />}
      </button>
    </div>
  );
};

export default DevToolsIndicator;
