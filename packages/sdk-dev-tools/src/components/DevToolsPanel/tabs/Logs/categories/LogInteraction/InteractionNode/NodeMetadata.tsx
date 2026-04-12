import { getValuesRequired } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import syntaxHighlight from '@plitzi/sdk-shared/helpers/syntaxHighlight';

import type { RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type NodeMetadataProps = {
  className?: string;
  when?: RuleGroup;
  whenParams?: Record<string, RuleValue>;
};

const NodeMetadata = ({ when, whenParams }: NodeMetadataProps) => {
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
      <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
        Params
      </span>
      <pre
        className="overflow-auto rounded bg-zinc-50 p-2 font-mono text-xs leading-5 dark:bg-zinc-800"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

export default NodeMetadata;
