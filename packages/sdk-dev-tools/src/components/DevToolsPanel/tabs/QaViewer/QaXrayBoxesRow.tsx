import clsx from 'clsx';
import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';

/** The boxes alone, picked: every element's box with its type and id, and no wiring marked over them. */
const QaXrayBoxesRow = () => {
  const { settings, setSetting } = use(QaContext);
  const only = settings.xrayFilter === 'none';

  const handleClick = useCallback(() => setSetting('xrayFilter', only ? 'all' : 'none'), [setSetting, only]);

  return (
    <button
      type="button"
      aria-pressed={only}
      title="Every element's box, its type and id when pointed at — and no wiring. Click again to mark it all."
      className={clsx('border-ui-line flex w-full cursor-pointer items-center gap-2 border-b px-2.5 py-1.5 text-left', {
        'bg-violet-500/10': only,
        'hover:bg-ui-hover': !only
      })}
      onClick={handleClick}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-dashed border-violet-500" />
      <span className="text-ui-fg min-w-0 truncate font-medium">Boxes only</span>
    </button>
  );
};

export default QaXrayBoxesRow;
