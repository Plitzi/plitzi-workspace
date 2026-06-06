import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import { formatDate } from '@plitzi/sdk-shared/helpers';

import type { CommonState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type BodyHeaderProps = {
  className?: string;
  triggerName: ReactNode;
  startTime: number;
  endTime: number;
  duration?: string;
  elementId?: string;
};

const BodyHeader = ({ triggerName, startTime, endTime, duration, elementId }: BodyHeaderProps) => {
  const { useStore } = createStoreHook<CommonState>();
  const [flat] = useStore('schema.flat');
  const element = useMemo(() => (elementId ? get(flat, elementId) : undefined), [elementId, flat]);
  const startTimeParsed = useMemo(() => formatDate(startTime, 'HH:mm:ss.SSS'), [startTime]);
  const endTimeParsed = useMemo(() => formatDate(endTime, 'HH:mm:ss.SSS'), [endTime]);
  const elementDOM = useMemo(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    return document.querySelector(`[data-id="${elementId}"]`);
  }, [elementId]);

  const handleClick = useCallback(() => {
    elementDOM?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [elementDOM]);

  const handleMouseEnter = useCallback(() => {
    elementDOM?.classList.add('devtools-element-hovered');
  }, [elementDOM]);

  const handleMouseLeave = useCallback(() => {
    elementDOM?.classList.remove('devtools-element-hovered');
  }, [elementDOM]);

  return (
    <div className="flex justify-around gap-3">
      {/* Times */}
      <div className="flex min-w-0 grow basis-0 flex-col">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          <i className="fa-regular fa-clock" />
          Times
        </div>
        <div className="flex flex-col gap-0.5 font-mono text-zinc-700 dark:text-zinc-300">
          <div className="flex gap-1">
            <span className="text-zinc-400 dark:text-zinc-500">Start</span>
            {startTimeParsed}
          </div>
          <div className="flex gap-1">
            <span className="text-zinc-400 dark:text-zinc-500">End</span>
            {endTimeParsed}
          </div>
          <div className="flex gap-1">
            <span className="text-zinc-400 dark:text-zinc-500">Duration</span>
            {duration}
          </div>
        </div>
      </div>

      <div className="w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />

      {/* Details */}
      <div className="flex min-w-0 grow basis-0 flex-col">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          <i className="fa-solid fa-circle-info" />
          Details
        </div>
        <div className="flex flex-col gap-0.5 text-zinc-700 dark:text-zinc-300">
          <div className="flex gap-1">
            <span className="text-zinc-400 dark:text-zinc-500">Type</span>
            <span>Interaction</span>
          </div>
          <div className="flex min-w-0 gap-1">
            <span className="shrink-0 text-zinc-400 dark:text-zinc-500">Trigger</span>
            <span className="truncate">{triggerName}</span>
          </div>
          <div className="flex min-w-0 gap-1">
            <span className="shrink-0 text-zinc-400 dark:text-zinc-500">Element</span>
            <span
              className="cursor-pointer truncate text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
              onClick={handleClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {element?.definition.label}
              {elementId && (
                <span className="ml-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">[{elementId}]</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyHeader;
