import clsx from 'clsx';
import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';

import type { VisionMode } from '../../../../qa/qaSettings';
import type { ChangeEvent } from 'react';

const MODES: { mode: VisionMode; label: string }[] = [
  { mode: 'none', label: 'Vision: as it is' },
  { mode: 'grayscale', label: 'No colour' },
  { mode: 'protanopia', label: 'Protanopia (red)' },
  { mode: 'deuteranopia', label: 'Deuteranopia (green)' },
  { mode: 'tritanopia', label: 'Tritanopia (blue)' },
  { mode: 'blurred', label: 'Low vision (blur)' }
];

const isVisionMode = (value: string): value is VisionMode => MODES.some(({ mode }) => mode === value);

/** The page as somebody who sees it differently does — whether a state still reads without its colour. */
const QaVisionSelect = () => {
  const { settings, setSetting } = use(QaContext);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (isVisionMode(event.target.value)) {
        setSetting('vision', event.target.value);
      }
    },
    [setSetting]
  );

  return (
    <select
      value={settings.vision}
      title="See the page without one kind of colour, or out of focus"
      onChange={handleChange}
      className={clsx(
        'h-6 shrink-0 rounded-md border bg-white py-0 pr-6 pl-2 text-[11px] leading-[22px] dark:bg-zinc-900',
        {
          'border-violet-400/60 text-violet-700 dark:text-violet-300': settings.vision !== 'none',
          'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300': settings.vision === 'none'
        }
      )}
    >
      {MODES.map(({ mode, label }) => (
        <option key={mode} value={mode}>
          {label}
        </option>
      ))}
    </select>
  );
};

export default QaVisionSelect;
