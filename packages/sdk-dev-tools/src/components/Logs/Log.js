/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 *   params?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const Log = props => {
  const { message, params = emptyObject } = props;

  console.log(params?.node?.when);

  const content = useMemo(() => syntaxHighlight(JSON.stringify({ ...(params?.node ?? {}) }, null, 2)), [params.node]);

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      title={message}
      collapsed
    >
      <div className="flex whitespace-pre">
        <pre dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </ContainerCollapsable>
  );
};

export default Log;
