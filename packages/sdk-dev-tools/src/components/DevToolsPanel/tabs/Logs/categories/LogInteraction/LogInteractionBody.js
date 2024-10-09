// Packages
import React from 'react';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import BodyHeader from './BodyHeader';
import BodyContent from './BodyContent';

/**
 * @param {{
 *   className?: string;
 *   node?: object;
 *   nodes?: object;
 *   startTime: string;
 *   endTime: string;
 *   duration?: string;
 *   elementId?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteractionBody = props => {
  const { node, nodes = emptyObject, startTime, endTime, duration, elementId } = props;

  return (
    <div className="flex flex-col m-2 gap-4">
      <BodyHeader
        triggerName={node.title}
        startTime={startTime}
        endTime={endTime}
        duration={duration}
        elementId={elementId}
      />
      <div className="border-t border-gray-300" />
      <BodyContent node={node} nodes={nodes} className="gap-4" />
    </div>
  );
};

export default LogInteractionBody;
