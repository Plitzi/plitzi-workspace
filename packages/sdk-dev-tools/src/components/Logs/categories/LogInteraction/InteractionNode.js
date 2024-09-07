// Packages
import React, { useMemo } from 'react';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import moment from 'moment';

// Monorepo
// import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

// Relatives
import ExecutionWhen from './ExecutionWhen';

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   startTime?: number;
 *   endTime?: number;
 *   status?: string;
 *   when?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const InteractionNode = props => {
  const { name = 'Node Title', startTime = 0, endTime = 0, status = 'notStarted', when } = props;
  // const content = useMemo(() => syntaxHighlight(JSON.stringify(node, null, 2)), [node]);

  const duration = useMemo(
    () => `${moment.duration(moment(endTime).diff(startTime)).asSeconds()}s`,
    [startTime, endTime]
  );

  return (
    <div className="flex flex-col w-full">
      <Heading type="h4" className="mb-0">
        {name}
      </Heading>
      <div className="flex gap-1 justify-between">
        <div className="flex gap-1">
          <div className="font-bold">Duration:</div>
          {duration}
        </div>
        <div className="flex gap-1">
          <div className="font-bold">Status:</div>
          {status}
        </div>
      </div>
      {/* <div className="flex grow whitespace-pre text-xs">
          <pre dangerouslySetInnerHTML={{ __html: content }} />
        </div> */}
      <ExecutionWhen when={when} />
    </div>
  );
};

export default InteractionNode;
