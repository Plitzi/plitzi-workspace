import clsx from 'clsx';

import { useDevToolsTheme } from '../../../../../../../DevToolsThemeContext';

export type NodeHeaderProps = {
  className?: string;
  duration?: string;
  status?: string;
  type?: string;
  action?: string;
};

const NodeHeader = ({ duration, status, type, action }: NodeHeaderProps) => {
  const { isDark } = useDevToolsTheme();

  const labelColor = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const valueColor = isDark ? 'text-zinc-300' : 'text-zinc-700';

  return (
    <div className={clsx('grid grid-cols-2 gap-x-3 gap-y-0.5 rounded p-2', isDark ? 'bg-zinc-800/60' : 'bg-zinc-50')}>
      <div className="flex gap-1.5">
        <span className={labelColor}>Duration</span>
        <span className={clsx('font-mono', valueColor)}>{duration}</span>
      </div>
      <div className="flex gap-1.5">
        <span className={labelColor}>Type</span>
        <span className={valueColor}>{type}</span>
      </div>
      <div className="flex gap-1.5">
        <span className={labelColor}>Status</span>
        <span className={valueColor}>{status}</span>
      </div>
      <div className="flex gap-1.5">
        <span className={labelColor}>Action</span>
        <span className={valueColor}>{action}</span>
      </div>
    </div>
  );
};

export default NodeHeader;
