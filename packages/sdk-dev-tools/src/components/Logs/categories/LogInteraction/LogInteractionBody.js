/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';

// Monorepo
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';
import BodyHeader from './BodyHeader';

/**
 * @param {{
 *   className?: string;
 *   node?: object;
 *   startTime?: string;
 *   endTime?: string;
 *   duration?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteractionBody = props => {
  const { node, startTime, endTime, duration } = props;
  const content = useMemo(() => syntaxHighlight(JSON.stringify(node, null, 2)), [node]);

  return (
    <div className="flex flex-col mt-4">
      <BodyHeader startTime={startTime} endTime={endTime} duration={duration} />
      <div className="flex whitespace-pre">
        <pre dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
};

export default LogInteractionBody;
