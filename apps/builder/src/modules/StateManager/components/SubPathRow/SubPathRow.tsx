import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { preview, valueAt } from '../../helpers';
import { STATE_COLUMNS } from '../../layout';
import UseCounts from '../UseCounts';
import UsedBy from '../UsedBy';

import type { StatePathUse } from '../../helpers';

export type SubPathRowProps = {
  /** The top-level key the path is under. */
  keyName: string;
  /** The key's value: the path's is read off it. */
  value: unknown;
  use: StatePathUse;
};

/**
 * A path the space names under a key, in the table's own columns: the path, its value, and what reads and writes it —
 * the counts unfold the elements, each a link. Read here; set in the tree.
 */
const SubPathRow = ({ keyName, value, use }: SubPathRowProps) => {
  const [usage, setUsage] = useState(false);
  const handleUsage = useCallback(() => setUsage(current => !current), []);
  const relative = use.path.slice(keyName.length + 1);
  const shown = preview(valueAt(value, relative.split('.')));

  return (
    <div className="flex flex-col">
      <div className={clsx(STATE_COLUMNS, 'min-h-7 py-0.5 pr-2 pl-2')}>
        <span className="min-w-0 truncate pl-4 font-mono text-[11px]" title={use.path}>
          <span className="text-ui-fg-subtle">{keyName}.</span>
          <span className="text-ui-fg-muted">{relative}</span>
        </span>
        <span className="text-ui-fg-subtle min-w-0 truncate px-1.5 font-mono text-[11px]" title={shown}>
          {shown}
        </span>
        <span />
        <UseCounts reads={use.reads} writes={use.writes} onClick={handleUsage} />
      </div>
      {usage && (
        <div className="pr-2 pl-11">
          <UsedBy reads={use.reads} writes={use.writes} />
        </div>
      )}
    </div>
  );
};

export default SubPathRow;
