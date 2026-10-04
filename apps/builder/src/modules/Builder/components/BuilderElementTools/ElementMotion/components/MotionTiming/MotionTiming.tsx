import Input from '@plitzi/plitzi-ui/Input';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useCallback, useId } from 'react';

import { MOTION_DEFAULT_DURATION, MOTION_TRIGGERS } from '@plitzi/sdk-shared/schema/motion';

import MotionTriggerOption from './components/MotionTriggerOption';
import { DEFAULT_STAGGER, TRIGGER_COPY } from '../../helpers';

import type { Draft } from '../../helpers';
import type { MotionTrigger } from '@plitzi/sdk-shared/schema/motion';
import type { ChangeEvent } from 'react';

export type MotionTimingProps = {
  draft: Draft;
  /** Whether the element holds children — what arriving one by one is about. */
  canHoldItems: boolean;
  onChange: (key: keyof Draft, value: string) => void;
};

/** When the arrival plays and how long it takes — and, for an element with children, whether they come one by one. */
const MotionTiming = ({ draft, canHoldItems, onChange }: MotionTimingProps) => {
  const trigger = MOTION_TRIGGERS.find(name => name === draft.on) ?? 'load';
  const staggered = draft.stagger !== '';
  const triggerLabel = useId();

  const handleTrigger = useCallback((value: MotionTrigger) => onChange('on', value), [onChange]);
  const handleDuration = useCallback((value: string) => onChange('duration', value), [onChange]);
  const handleDelay = useCallback((value: string) => onChange('delay', value), [onChange]);
  const handleStagger = useCallback((value: string) => onChange('stagger', value), [onChange]);
  const handleStaggered = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange('stagger', event.target.checked ? String(DEFAULT_STAGGER) : ''),
    [onChange]
  );

  return (
    <div className="@container flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span id={triggerLabel} className="w-12 shrink-0 text-xs text-gray-600 dark:text-zinc-300">
            Plays
          </span>
          <div
            role="radiogroup"
            aria-labelledby={triggerLabel}
            className="grid grow grid-cols-3 gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-zinc-800"
          >
            {MOTION_TRIGGERS.map(name => (
              <MotionTriggerOption
                key={name}
                trigger={name}
                label={TRIGGER_COPY[name].label}
                selected={trigger === name}
                onSelect={handleTrigger}
              />
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-500 dark:text-zinc-400">{TRIGGER_COPY[trigger].hint}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 @min-[320px]:grid-cols-3">
        <Input
          size="xs"
          type="number"
          min={0}
          label="Duration (ms)"
          placeholder={String(MOTION_DEFAULT_DURATION)}
          value={draft.duration}
          onChange={handleDuration}
        />
        <Input
          size="xs"
          type="number"
          min={0}
          label="Delay (ms)"
          placeholder="0"
          value={draft.delay}
          onChange={handleDelay}
        />
        {canHoldItems && staggered && trigger !== 'scroll' && (
          <Input
            size="xs"
            type="number"
            min={0}
            label="Children one by one (ms)"
            placeholder={String(DEFAULT_STAGGER)}
            value={draft.stagger}
            onChange={handleStagger}
          />
        )}
      </div>
      {canHoldItems && (
        <div className="flex flex-col gap-1">
          <Switch size="xs" label="Children arrive one by one" checked={staggered} onChange={handleStaggered} />
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            Each child a moment after the one before, rather than the element as a whole — a grid of cards, a
            list&apos;s rows. Up to the first 24.
          </span>
        </div>
      )}
    </div>
  );
};

export default MotionTiming;
