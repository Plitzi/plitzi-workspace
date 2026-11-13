import { useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared/dates';

import NodeHeader from './NodeHeader';
import NodeMetadata from './NodeMetadata';
import NodeWhen from './NodeWhen';

import type { RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

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
  const duration = useMemo(() => `${getDurationMs(startTime, endTime)}ms`, [startTime, endTime]);

  return (
    <div className="text-ui-fg flex w-full flex-col gap-2 p-2">
      <div className="text-ui-fg truncate font-semibold">{name}</div>
      <NodeHeader duration={duration} status={status} type={type} action={action} />
      <NodeWhen when={when} />
      <NodeMetadata when={when} whenParams={whenParams} />
    </div>
  );
};

export default InteractionNode;
