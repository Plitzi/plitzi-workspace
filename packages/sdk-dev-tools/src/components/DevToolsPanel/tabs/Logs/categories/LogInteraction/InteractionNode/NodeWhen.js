// Packages
import React, { useMemo } from 'react';
import QueryBuilderFormatter from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderFormatter.js';
import Heading from '@plitzi/plitzi-ui-components/Heading/index.js';

/**
 * @param {{
 *   className?: string;
 *   when?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeWhen = props => {
  const { when } = props;

  const whenStr = useMemo(() => {
    const str = QueryBuilderFormatter(when);
    if (str) {
      return str;
    }

    return 'None';
  }, [when]);

  return (
    <div className="flex flex-col break-all">
      <Heading type="h5" className="mt-2 mb-0">
        Condition to execute
      </Heading>
      {whenStr}
    </div>
  );
};

export default NodeWhen;
