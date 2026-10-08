import { useCallback, useEffect, useMemo, useState } from 'react';

import { bezierCss, easingCss, easingCurve, easingOptions } from './helpers';
import InputEasing from '../../../../InputEasing';
import { easingGenerics } from '../../../../InputEasing/InputEasingHelper';
import InputEasingList from '../../../../InputEasing/InputEasingList';
import CategoryOption from '../../../components/CategoryOption';
import { asText } from '../../../cssValues';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TransitionEasingProps = {
  value: string;
  onChange: (easing: string) => void;
};

const OPTIONS = easingOptions(easingGenerics);

/** A full pass of the preview, in milliseconds. */
const PREVIEW_MS = 1600;

/**
 * The easing of one transition: a picker of the named curves, and — opened from it — the curve itself, to drag into
 * one of your own, with the presets drawn and a dot that runs along it.
 */
const TransitionEasing = ({ value, onChange }: TransitionEasingProps) => {
  const [curveOpen, setCurveOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const curve = easingCurve(value, easingGenerics);
  const listed = OPTIONS.some(option => option.value === value);

  // Stopped when the editor goes, not only when its button is pressed: an interval left running would outlive it.
  useEffect(() => {
    if (!playing) {
      setProgress(0);

      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setProgress(((now - start) % PREVIEW_MS) / PREVIEW_MS);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const handleChangePreset = useCallback(
    (preset: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange(asText(preset)),
    [onChange]
  );

  const handlePickPreset = useCallback((name: string) => onChange(easingCss(name, easingGenerics)), [onChange]);

  const handleDragCurve = useCallback(
    (points: number[]) => {
      const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = points;
      onChange(bezierCss([x1, y1, x2, y2]));
    },
    [onChange]
  );

  const handleToggleCurve = useCallback(() => setCurveOpen(state => !state), []);

  const handleTogglePlay = useCallback(() => setPlaying(state => !state), []);

  const customLabel = useMemo(() => `Custom — ${value}`, [value]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 grow">
          <CategoryOption label="Easing" type="select" value={value} onChange={handleChangePreset}>
            {!listed && <option value={value}>{customLabel}</option>}
            {OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CategoryOption>
        </div>
        <button
          type="button"
          className="aria-pressed:border-primary-500 aria-pressed:text-primary-600 dark:aria-pressed:text-primary-300 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-200 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
          aria-pressed={curveOpen}
          title={curveOpen ? 'Hide the curve' : 'Edit the curve'}
          aria-label={curveOpen ? 'Hide the curve' : 'Edit the curve'}
          onClick={handleToggleCurve}
        >
          <i className="fa-solid fa-bezier-curve text-xs" />
        </button>
      </div>
      {curveOpen && !curve && (
        <p className="m-0 text-[11px] text-zinc-500 dark:text-zinc-400">
          {value} is not a curve, so there is nothing to drag. Pick a preset to start from one.
        </p>
      )}
      {curveOpen && curve && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-gray-200 p-2 dark:border-zinc-700">
          <InputEasing
            value={curve}
            progress={progress}
            width={200}
            height={200}
            handleRadius={6}
            onChange={handleDragCurve}
          />
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            onClick={handleTogglePlay}
          >
            <i className={playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'} />
            {playing ? 'Pause preview' : 'Preview'}
          </button>
          <InputEasingList className="w-full border-r-0" onChange={handlePickPreset} />
        </div>
      )}
    </div>
  );
};

export default TransitionEasing;
