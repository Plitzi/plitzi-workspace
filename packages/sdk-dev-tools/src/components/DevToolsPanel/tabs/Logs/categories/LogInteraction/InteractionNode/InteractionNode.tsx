import { useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared';

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
    <div className="flex w-full flex-col gap-2 p-2 text-zinc-700 dark:text-zinc-300">
      <div className="truncate font-semibold text-zinc-800 dark:text-zinc-200">{name}</div>
      <NodeHeader duration={duration} status={status} type={type} action={action} />
      <NodeWhen when={when} />
      <NodeMetadata when={when} whenParams={whenParams} />
    </div>
  );
};

export default InteractionNode;
