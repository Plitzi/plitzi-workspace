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

  return (
    <div className="flex grow whitespace-pre text-xs">
      <pre dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
};

export default NodeMetadata;
