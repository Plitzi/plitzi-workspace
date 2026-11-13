import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { isBranch, preview, valueAt } from '../../helpers';
import { STATE_COLUMNS } from '../../layout';
import UseCounts from '../UseCounts';
import UsedBy from '../UsedBy';
import ValueEditor from '../ValueEditor';

import type { StatePathUse } from '../../helpers';
import type { StateChange } from '../../hooks/useStateChanges';

export type SubPathRowProps = {
  /** The top-level key the path is under. */
  keyName: string;
  /** The key's value: the path's is read off it. */
  value: unknown;
  use: StatePathUse;
  /** The path's last change while the panel is open: its row says it moved. */
  lastChange?: StateChange;
  /** Sets this path alone. */
  onChange: (segments: [string, ...string[]], value: unknown) => void;
};

/**
 * A path the space names under a key, in the table's own columns: the path, its value set in place — that path alone,
 * never the whole of what holds it — and what reads and writes it, the counts unfolding the elements, each a link. A
 * path that holds an object or a list shows it in a line: the key's JSON edits it.
 */
const SubPathRow = ({ keyName, value, use, lastChange, onChange }: SubPathRowProps) => {
  const [usage, setUsage] = useState(false);
  const handleUsage = useCallback(() => setUsage(current => !current), []);
  const relative = use.path.slice(keyName.length + 1);
  const segments = relative.split('.');
  const current = valueAt(value, segments);
  const shown = preview(current);

  const handleChange = useCallback(
    (next: unknown) => onChange([keyName, ...use.path.slice(keyName.length + 1).split('.')], next),
    [keyName, use.path, onChange]
  );

  return (
    <div className="flex flex-col">
      <div className={clsx(STATE_COLUMNS, 'relative min-h-7 py-0.5 pr-2 pl-2')}>
        {lastChange && (
          <span
            key={lastChange.id}
            className="animate-state-flash bg-primary-400/25 pointer-events-none absolute inset-0"
            aria-hidden
          />
        )}
        <span className="min-w-0 truncate pl-4 font-mono text-[11px]" title={use.path}>
          <span className="text-ui-fg-subtle">{keyName}.</span>
          <span className="text-ui-fg-muted">{relative}</span>
        </span>
        <div className="min-w-0">
          {isBranch(current) ? (
            <span className="text-ui-fg-subtle block truncate px-1.5 font-mono text-[11px]" title={shown}>
              {shown}
            </span>
          ) : (
            <ValueEditor value={current} onChange={handleChange} />
          )}
        </div>
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
