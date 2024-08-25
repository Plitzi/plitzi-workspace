/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

// Relatives
import LogStatus from '../LogStatus';

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 *   params: object;
 *   time: string;
 *   duration: string;
 *   logType: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteraction = props => {
  const { time, duration = '0.00s', message, params: { node = emptyObject } = emptyObject, logType } = props;
  console.log(props.params);

  // console.log(params?.node?.when);
  const content = useMemo(() => syntaxHighlight(JSON.stringify(node, null, 2)), [node]);

  // const message = useMemo(() => `${capitalize(nodeType)} [${node?.title}]`, [node]);

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      title={
        <div className="flex justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="font-bold">{time}</span>
            <LogStatus logType={logType} />
            {message}
          </div>
          {duration}
        </div>
      }
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
