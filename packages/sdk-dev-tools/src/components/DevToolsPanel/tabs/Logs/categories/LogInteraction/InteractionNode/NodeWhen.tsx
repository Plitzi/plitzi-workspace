import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { useMemo } from 'react';

import { useDevToolsTheme } from '../../../../../../../DevToolsThemeContext';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type NodeWhenProps = {
  when?: RuleGroup;
};

const NodeWhen = ({ when }: NodeWhenProps) => {
  const { isDark } = useDevToolsTheme();

  const whenStr = useMemo(() => {
    if (!when) {
      return null;
    }

    return QueryBuilderFormatter(when) || null;
  }, [when]);

  if (!whenStr) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={clsx(
          'text-[10px] font-semibold tracking-wider uppercase',
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        )}
      >
        Condition
      </span>
      <span className={clsx('break-all', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{whenStr}</span>
    </div>
  );
};

export default NodeWhen;
