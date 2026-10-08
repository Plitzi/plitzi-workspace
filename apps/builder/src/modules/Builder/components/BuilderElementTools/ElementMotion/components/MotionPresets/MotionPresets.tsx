import { useCallback, useEffect, useRef, useState } from 'react';

import MotionPresetChip from './components/MotionPresetChip';
import { isEmphasised, LOOP_PREVIEW_EMPHASIS, previewOf } from '../../helpers';

import type { PresetCopy, PresetKind } from '../../helpers';

export type MotionPresetsProps = {
  kind: PresetKind;
  /** The question the presets answer, which names the group. */
  title: string;
  /** What choosing none is called here, and what it looks like. */
  none: PresetCopy;
  presets: Record<string, PresetCopy>;
  value: string;
  /** The person asked their system for less motion: the stage shows where a preset ends, without playing it. */
  still: boolean;
  onChange: (value: string) => void;
};

/**
 * One of the tab's two questions — how it arrives, whether it keeps moving — answered by picking a preset, with a stage
 * that plays the one being looked at on a card (over and over while the pointer or the focus rests on it) and otherwise
 * the chosen one, once. The stage is as wide as the sidebar; the chips wrap into as many columns as it fits.
 */
const MotionPresets = ({ kind, title, none, presets, value, still, onChange }: MotionPresetsProps) => {
  const card = useRef<HTMLSpanElement>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const [replays, setReplays] = useState(0);
  const shown = looking ?? value;
  const copy = Object.hasOwn(presets, shown) ? presets[shown] : none;

  useEffect(() => {
    const preview = previewOf(kind, shown, looking !== null);
    if (still || !preview || !card.current) {
      return undefined;
    }

    const animation = card.current.animate(preview.keyframes, preview.options);

    return () => animation.cancel();
  }, [kind, shown, looking, still, replays]);

  const handleLookAway = useCallback(() => setLooking(null), []);
  const handleReplay = useCallback(() => setReplays(count => count + 1), []);

  return (
    <div className="@container">
      <div className="grid gap-2 @min-[320px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            title="Play it again"
            aria-label={`Preview: ${copy.label}`}
            className="relative flex h-20 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900"
            onClick={handleReplay}
          >
            <span
              ref={card}
              className="flex w-16 flex-col gap-1 rounded border border-gray-200 bg-white p-1.5 shadow-sm dark:border-zinc-600 dark:bg-zinc-700"
            >
              <span className="bg-primary-400 h-1.5 w-3/4 rounded-full" />
              <span className="h-1 w-full rounded-full bg-gray-200 dark:bg-zinc-500" />
              <span className="h-1 w-1/2 rounded-full bg-gray-200 dark:bg-zinc-500" />
            </span>
            {isEmphasised(kind, shown) && (
              <span
                title={`Shown ${String(LOOP_PREVIEW_EMPHASIS)}× stronger here than on the page, where it is meant to be barely noticed`}
                className="absolute top-1 right-1 rounded bg-gray-200 px-1 text-[11px] leading-4 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300"
              >
                {LOOP_PREVIEW_EMPHASIS}× here
              </span>
            )}
          </button>
          {/* A fixed height: a caption that grew with its text would move the chips under the pointer looking at them. */}
          <span className="line-clamp-2 h-8 text-xs text-gray-500 dark:text-zinc-400">
            <span className="font-medium text-gray-800 dark:text-zinc-100">{copy.label}</span> — {copy.hint}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label={title}
          className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] content-start gap-1"
        >
          <MotionPresetChip
            value=""
            label={none.label}
            selected={value === ''}
            onSelect={onChange}
            onLook={setLooking}
            onLookAway={handleLookAway}
          />
          {Object.entries(presets).map(([name, preset]) => (
            <MotionPresetChip
              key={name}
              value={name}
              label={preset.label}
              selected={value === name}
              onSelect={onChange}
              onLook={setLooking}
              onLookAway={handleLookAway}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MotionPresets;
