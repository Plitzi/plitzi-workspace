// Packages
import React, { useMemo } from 'react';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import moment from 'moment';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import NodeWhen from './NodeWhen';
import NodeMetadata from './NodeMetadata';
import NodeHeader from './NodeHeader';

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   startTime?: number;
 *   endTime?: number;
 *   status?: string;
 *   when?: string;
 *   whenParams?: object;
 *   type?: string;
 *   action?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const InteractionNode = props => {
  const {
    whenParams = emptyObject,
    name = 'Node Title',
    startTime = 0,
    endTime = 0,
    status = 'notStarted',
    when,
    type,
    action
  } = props;

  const duration = useMemo(
    () => `${moment.duration(moment(endTime).diff(startTime)).asMilliseconds()}ms`,
    [startTime, endTime]
  );

  return (
    <div className="flex flex-col w-full">
      <Heading type="h4" className="m-0">
        {name}
      </Heading>
      <NodeHeader duration={duration} status={status} type={type} action={action} />
      <NodeWhen when={when} />
      <NodeMetadata when={when} whenParams={whenParams} />
    </div>
  );
};

export default InteractionNode;
