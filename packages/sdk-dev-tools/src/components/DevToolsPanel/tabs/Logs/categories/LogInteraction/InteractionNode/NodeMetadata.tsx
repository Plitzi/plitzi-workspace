import { getValuesRequired } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import { syntaxHighlight } from '@plitzi/sdk-shared/helpers';
import { ownHtml } from '@plitzi/sdk-shared/security';

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
      <span className="text-ui-fg-subtle text-[10px] font-semibold tracking-wider uppercase">Params</span>
      <pre
        className="bg-ui-raised overflow-auto rounded p-2 font-mono text-xs leading-5"
        dangerouslySetInnerHTML={{ __html: ownHtml(content) }}
      />
    </div>
  );
};

export default NodeMetadata;
