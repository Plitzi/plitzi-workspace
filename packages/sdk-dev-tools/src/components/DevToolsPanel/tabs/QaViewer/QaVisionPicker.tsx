import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';

import type { VisionMode } from '../../../../qa/qaSettings';
import type { ChangeEvent } from 'react';

const MODES: { mode: VisionMode; label: string }[] = [
  { mode: 'none', label: 'As it is' },
  { mode: 'grayscale', label: 'No colour (grayscale)' },
  { mode: 'protanopia', label: 'Protanopia (no red)' },
  { mode: 'deuteranopia', label: 'Deuteranopia (no green)' },
  { mode: 'tritanopia', label: 'Tritanopia (no blue)' },
  { mode: 'blurred', label: 'Low vision (blurred)' }
];

const isVisionMode = (value: string): value is VisionMode => MODES.some(({ mode }) => mode === value);

/** The page as somebody who sees it differently does — whether a state still reads without its colour. */
const QaVisionPicker = () => {
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
    <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Vision</span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          The page as it is seen without one kind of colour, or out of focus
        </span>
      </span>
      <select
        value={settings.vision}
        onChange={handleChange}
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {MODES.map(({ mode, label }) => (
          <option key={mode} value={mode}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default QaVisionPicker;
