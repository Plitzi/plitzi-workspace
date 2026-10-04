import { use, useCallback, useMemo, useState } from 'react';

import useReducedMotion from '@plitzi/sdk-elements/canvas/useReducedMotion';
import { isMotion, motionProblems } from '@plitzi/sdk-shared/schema/motion';
import AppContext from '@pmodules/App/AppContext';

import MotionPresets from './components/MotionPresets';
import MotionSection from './components/MotionSection';
import MotionSummary from './components/MotionSummary';
import MotionTiming from './components/MotionTiming';
import { ARRIVES_NONE, describeMotion, draftOf, ENTER_COPY, LOOP_COPY, LOOP_NONE, motionOf } from './helpers';

import type { Draft } from './helpers';
import type { ElementMotion as Motion } from '@plitzi/sdk-shared/schema/motion';

export type ElementMotionProps = {
  motion?: Motion;
  /** Whether the element holds children — what arriving one by one is about. */
  canHoldItems?: boolean;
  /** A page does not move: what is in it does. */
  isPage?: boolean;
  /** `undefined` removes it: the element does not move. */
  onUpdate?: (key: string, value: Motion | undefined, isDefinition?: boolean) => void;
};

/**
 * How the element arrives — and when, and whether its children follow one by one — and whether it keeps moving: the
 * presets the SDK's stylesheet plays, each previewed on its tile, and the choices read back as a sentence. Opacity and
 * transforms only, stilled for a visitor who asked for less motion.
 *
 * Saved as soon as it is one the page can play; while it is not, the tab says why and the element keeps the one it had.
 */
const ElementMotion = ({ motion, canHoldItems = false, isPage = false, onUpdate }: ElementMotionProps) => {
  const { motionPlaying, replayMotion } = use(AppContext);
  const still = useReducedMotion();
  const [draft, setDraft] = useState(() => draftOf(motion));
  const written = useMemo(() => motionOf(draft), [draft]);
  const problems = useMemo(() => (Object.keys(written).length === 0 ? [] : motionProblems(written)), [written]);
  const sentence = useMemo(() => {
    if (Object.keys(written).length === 0) {
      return 'It does not move: it is where it is from the first paint.';
    }

    return isMotion(written) ? describeMotion(written) : 'It cannot move like this yet:';
  }, [written]);

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
  const handleLoop = useCallback((value: string) => change('loop', value), [change]);

  if (isPage) {
    return (
      <p className="m-0 p-2 text-xs text-gray-500 dark:text-zinc-400">
        A page does not move — what is in it does. Select a section, a heading or a card to give it motion.
      </p>
    );
  }

  return (
    <div className="flex flex-col" aria-label="Motion">
      {still && (
        <span className="border-b border-gray-200 p-2 text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
          Your system asks for less motion, so the previews are still — and so is this element for every visitor who
          asks the same.
        </span>
      )}
      <MotionSection title="Arrives">
        <MotionPresets
          kind="enter"
          title="Arrives"
          none={ARRIVES_NONE}
          presets={ENTER_COPY}
          value={draft.enter}
          still={still}
          onChange={handleEnter}
        />
      </MotionSection>
      {draft.enter !== '' && (
        <MotionSection title="Timing">
          <MotionTiming draft={draft} canHoldItems={canHoldItems} onChange={change} />
        </MotionSection>
      )}
      <MotionSection title="Keeps moving">
        <MotionPresets
          kind="loop"
          title="Keeps moving"
          none={LOOP_NONE}
          presets={LOOP_COPY}
          value={draft.loop}
          still={still}
          onChange={handleLoop}
        />
      </MotionSection>
      <MotionSection title="Result">
        <MotionSummary sentence={sentence} problems={problems} playing={motionPlaying} onPlay={replayMotion} />
      </MotionSection>
    </div>
  );
};

export default ElementMotion;
