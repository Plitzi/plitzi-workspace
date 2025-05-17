import Heading from '@plitzi/plitzi-ui/Heading';
import moment from 'moment';
import { useMemo } from 'react';

import NodeHeader from './NodeHeader';
import NodeMetadata from './NodeMetadata';
import NodeWhen from './NodeWhen';

import type { RuleGroup, RuleValue } from '@plitzi/plitzi-ui';

export type InteractionNodeProps = {
  className?: string;
  name?: string;
  startTime?: number;
  endTime?: number;
  status?: string;
  when?: RuleGroup;
  whenParams?: Record<string, RuleValue>;
  type?: string;
  action?: string;
};

const InteractionNode = ({
  whenParams,
  name = 'Node Title',
  startTime = 0,
  endTime = 0,
  status = 'notStarted',
  when,
  type,
  action
}: InteractionNodeProps) => {
  const duration = useMemo(
    () => `${moment.duration(moment(endTime).diff(startTime)).asMilliseconds()}ms`,
    [startTime, endTime]
  );

  return (
    <div className="flex flex-col w-full">
      <Heading as="h4" className="m-0">
        {name}
      </Heading>
      <NodeHeader duration={duration} status={status} type={type} action={action} />
      <NodeWhen when={when} />
      <NodeMetadata when={when} whenParams={whenParams} />
    </div>
  );
};

export default InteractionNode;
