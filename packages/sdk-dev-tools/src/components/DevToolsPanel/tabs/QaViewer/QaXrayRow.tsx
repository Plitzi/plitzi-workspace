import clsx from 'clsx';
import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';
import { XRAY } from '../../../../qa/xray';

import type { XrayMark } from '../../../../qa/xray';

export type QaXrayRowProps = { mark: XrayMark };

/** One kind of wiring: how many elements of the page carry it — and, picked, the only one the x-ray shows. */
const QaXrayRow = ({ mark }: QaXrayRowProps) => {
  const { settings, setSetting, xrayCounts } = use(QaContext);
  const { label, description, colour } = XRAY[mark];
  const only = settings.xrayFilter === mark;

  const handleClick = useCallback(() => setSetting('xrayFilter', only ? 'all' : mark), [setSetting, only, mark]);

  return (
    <button
      type="button"
      aria-pressed={only}
      title={`${description}. Click to show only these; again for all.`}
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 border-b border-zinc-100 px-2.5 py-1.5 text-left last:border-b-0 dark:border-zinc-800',
        {
          'bg-violet-500/10': only,
          'hover:bg-zinc-50 dark:hover:bg-zinc-800/60': !only,
          'opacity-50': settings.xrayFilter !== 'all' && !only
        }
      )}
      onClick={handleClick}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
      <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <span className="ml-auto rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
        {xrayCounts[mark]}
      </span>
    </button>
  );
};

export default QaXrayRow;
