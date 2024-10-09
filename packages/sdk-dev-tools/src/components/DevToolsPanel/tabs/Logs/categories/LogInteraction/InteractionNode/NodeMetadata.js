// Packages
import React, { useMemo } from 'react';
import { getValuesRequired } from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderEvaluator';

// Monorepo
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';
import { emptyObject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   className?: string;
 *   when?: object;
 *   whenParams?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeMetadata = props => {
  const { when = emptyObject, whenParams = emptyObject } = props;
  const content = useMemo(() => {
    if (Object.keys(when).length === 0) {
      return '';
    }

    return syntaxHighlight(JSON.stringify(getValuesRequired(when, whenParams, null), null, 2));
  }, [whenParams, when]);

  return (
    <div className="flex grow whitespace-pre text-xs">
      <pre dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
};

export default NodeMetadata;
