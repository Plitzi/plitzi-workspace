import { getValuesRequired } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { useMemo } from 'react';

import syntaxHighlight from '@plitzi/sdk-shared/helpers/syntaxHighlight';

import { useDevToolsTheme } from '../../../../../../../DevToolsThemeContext';

import type { RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type NodeMetadataProps = {
  className?: string;
  when?: RuleGroup;
  whenParams?: Record<string, RuleValue>;
};

const NodeMetadata = ({ when, whenParams }: NodeMetadataProps) => {
  const { isDark } = useDevToolsTheme();

  const content = useMemo<string>(() => {
    if (!when || Object.keys(when).length === 0) {
      return '';
    }

    return syntaxHighlight(JSON.stringify(getValuesRequired(when, whenParams), null, 2)) as string;
  }, [whenParams, when]);

  if (!content) {
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
        Params
      </span>
      <pre
        className={clsx('overflow-auto rounded p-2 font-mono text-xs leading-5', isDark ? 'bg-zinc-800' : 'bg-zinc-50')}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

export default NodeMetadata;
