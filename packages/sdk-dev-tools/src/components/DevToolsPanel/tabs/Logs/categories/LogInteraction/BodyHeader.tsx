import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { formatDate } from '@plitzi/sdk-shared/helpers';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';

import type { CommonState, Element } from '@plitzi/sdk-shared';
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
  const { isDark } = useDevToolsTheme();
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

  const labelColor = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const valueColor = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const dividerColor = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  const sectionTitle = clsx(
    'mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider',
    labelColor
  );

  return (
    <div className="flex justify-around gap-3">
      {/* Times */}
      <div className="flex min-w-0 grow basis-0 flex-col">
        <div className={sectionTitle}>
          <i className="fa-regular fa-clock" />
          Times
        </div>
        <div className={clsx('flex flex-col gap-0.5 font-mono', valueColor)}>
          <div className="flex gap-1">
            <span className={labelColor}>Start</span>
            {startTimeParsed}
          </div>
          <div className="flex gap-1">
            <span className={labelColor}>End</span>
            {endTimeParsed}
          </div>
          <div className="flex gap-1">
            <span className={labelColor}>Duration</span>
            {duration}
          </div>
        </div>
      </div>

      <div className={clsx('w-px shrink-0', dividerColor)} />

      {/* Details */}
      <div className="flex min-w-0 grow basis-0 flex-col">
        <div className={sectionTitle}>
          <i className="fa-solid fa-circle-info" />
          Details
        </div>
        <div className={clsx('flex flex-col gap-0.5', valueColor)}>
          <div className="flex gap-1">
            <span className={labelColor}>Type</span>
            <span>Interaction</span>
          </div>
          <div className="flex min-w-0 gap-1">
            <span className={clsx('shrink-0', labelColor)}>Trigger</span>
            <span className="truncate">{triggerName}</span>
          </div>
          <div className="flex min-w-0 gap-1">
            <span className={clsx('shrink-0', labelColor)}>Element</span>
            <span
              className={clsx(
                'cursor-pointer truncate',
                isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'
              )}
              onClick={handleClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {(element as Element | undefined)?.definition.label}
              {elementId && <span className={clsx('ml-1 font-mono text-[10px]', labelColor)}>[{elementId}]</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyHeader;
