import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback, useMemo, useState } from 'react';

import {
  isMotion,
  MOTION_ENTERS,
  MOTION_LOOPS,
  MOTION_TRIGGERS,
  motionProblems
} from '@plitzi/sdk-shared/schema/motion';
import AppContext from '@pmodules/App/AppContext';

import type { ElementMotion as Motion } from '@plitzi/sdk-shared/schema/motion';

export type ElementMotionProps = {
  motion?: Motion;
  /** Whether the element holds children — what `stagger` times one after another. */
  canHoldItems?: boolean;
  /** `undefined` removes it: the element does not move. */
  onUpdate?: (key: string, value: Motion | undefined, isDefinition?: boolean) => void;
};

type Timing = 'duration' | 'delay' | 'stagger';

/** What the fields hold while typed: the presets as chosen, the timings as written. */
type Draft = { enter: string; on: string; loop: string } & Record<Timing, string>;

const draftOf = (motion: Motion | undefined): Draft => ({
  enter: motion?.enter ?? '',
  on: motion?.on ?? 'load',
  loop: motion?.loop ?? '',
  duration: motion?.duration === undefined ? '' : String(motion.duration),
  delay: motion?.delay === undefined ? '' : String(motion.delay),
  stagger: motion?.stagger === undefined ? '' : String(motion.stagger)
});

/** The draft as a motion: the fields left empty are left out, and `on` only beside an arrival it times. */
const motionOf = (draft: Draft): Record<string, unknown> => {
  const timing = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value));
  const entries: [string, unknown][] = [
    ['enter', draft.enter || undefined],
    ['on', draft.enter && draft.on !== 'load' ? draft.on : undefined],
    ['duration', timing(draft.duration)],
    ['delay', timing(draft.delay)],
    ['stagger', timing(draft.stagger)],
    ['loop', draft.loop || undefined]
  ];

  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
};

/**
 * How the element arrives — and when, and whether its children follow one by one — and whether it keeps moving. The
 * presets the SDK's stylesheet plays: opacity and transforms only, stilled for a visitor who asked for less motion.
 *
 * Saved as soon as it is one the page can play; while it is not, the panel says why and the element keeps the one it
 * had. On the canvas the motion is still until played (the header's ▶, or Play here).
 */
const ElementMotion = ({ motion, canHoldItems = false, onUpdate }: ElementMotionProps) => {
  const { replayMotion } = use(AppContext);
  const [draft, setDraft] = useState(() => draftOf(motion));
  const written = useMemo(() => motionOf(draft), [draft]);
  const nothing = Object.keys(written).length === 0;
  const problems = useMemo(() => (nothing ? [] : motionProblems(written)), [nothing, written]);

  const change = useCallback(
    (key: keyof Draft, value: string) => {
      const next = { ...draft, [key]: value };
      setDraft(next);
      const candidate = motionOf(next);
      if (Object.keys(candidate).length === 0) {
        onUpdate?.('motion', undefined, true);

        return;
      }

      if (isMotion(candidate)) {
        onUpdate?.('motion', candidate, true);
      }
    },
    [draft, onUpdate]
  );

  const handleEnter = useCallback((value: string) => change('enter', value), [change]);
  const handleOn = useCallback((value: string) => change('on', value), [change]);
  const handleLoop = useCallback((value: string) => change('loop', value), [change]);
  const handleDuration = useCallback((value: string) => change('duration', value), [change]);
  const handleDelay = useCallback((value: string) => change('delay', value), [change]);
  const handleStagger = useCallback((value: string) => change('stagger', value), [change]);

  return (
    <div className="flex flex-col gap-1" aria-label="Motion">
      <div className="flex items-end gap-2">
        <Select size="xs" label="Arrives" value={draft.enter} onChange={handleEnter}>
          <option value="">Without motion</option>
          {MOTION_ENTERS.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select size="xs" label="Keeps moving" value={draft.loop} onChange={handleLoop}>
          <option value="">No</option>
          {MOTION_LOOPS.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Button size="xs" intent="secondary" disabled={nothing || problems.length > 0} onClick={replayMotion}>
          Play
        </Button>
      </div>
      {draft.enter !== '' && (
        <div className="flex gap-2">
          <Select size="xs" label="When" value={draft.on} onChange={handleOn}>
            {MOTION_TRIGGERS.map(trigger => (
              <option key={trigger} value={trigger}>
                {trigger === 'view' ? 'As it scrolls into view' : 'As the page loads'}
              </option>
            ))}
          </Select>
          <Input size="xs" label="Duration (ms)" placeholder="600" value={draft.duration} onChange={handleDuration} />
          <Input size="xs" label="Delay (ms)" placeholder="0" value={draft.delay} onChange={handleDelay} />
          {canHoldItems && (
            <Input
              size="xs"
              label="Children one by one (ms)"
              placeholder="—"
              title="Its children arrive one after another, this far apart, rather than the element itself."
              value={draft.stagger}
              onChange={handleStagger}
            />
          )}
        </div>
      )}
      {problems.length > 0 && <span className="text-xs text-red-600 dark:text-red-400">{problems.join(' · ')}</span>}
    </div>
  );
};

export default ElementMotion;
