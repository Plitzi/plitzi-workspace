/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import capitalize from 'lodash/capitalize';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 *   params: object;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteraction = props => {
  const { params: { node = emptyObject, nodeType } = emptyObject } = props;

  // console.log(params?.node?.when);
  const content = useMemo(() => syntaxHighlight(JSON.stringify(node, null, 2)), [node]);

  const message = useMemo(() => `${capitalize(nodeType)} [${node?.title}]`, [node]);

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      title={message}
      collapsed
    >
      <div>
        <div className="flex whitespace-pre">
          <pre dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </ContainerCollapsable>
  );
};

export default LogInteraction;
