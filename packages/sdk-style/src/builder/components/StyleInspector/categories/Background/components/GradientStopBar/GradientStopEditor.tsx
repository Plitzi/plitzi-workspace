import ColorPicker from '@plitzi/plitzi-ui/ColorPicker';
import MetricInput from '@plitzi/plitzi-ui/MetricInput';

import type { GradientStop } from '../../helpers/backgroundParser';

type GradientStopEditorProps = {
  stop: GradientStop;
  canRemove: boolean;
  onColorChange: (color: string) => void;
  onPositionChange: (value: string) => void;
  onAdd: () => void;
  onRemove: () => void;
};

const POSITION_UNITS = [
  { label: '%', value: '%' },
  { label: 'PX', value: 'px' }
];

/** The selected stop's color and position, and the two buttons that change how many stops there are. */
const GradientStopEditor = ({
  stop,
  canRemove,
  onColorChange,
  onPositionChange,
  onAdd,
  onRemove
}: GradientStopEditorProps) => (
  <div className="flex flex-col gap-1.5">
    <ColorPicker
      size="xs"
      className={{ root: 'w-full min-w-0' }}
      value={stop.color}
      allowVariables
      showAlpha
      onChange={onColorChange}
    />
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">At</span>
      <MetricInput
        size="xs"
        className="w-24 shrink-0"
        value={stop.position}
        units={POSITION_UNITS}
        allowedWords={[]}
        min={-Infinity}
        onChange={onPositionChange}
      />
      <span className="grow" />
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 hover:bg-gray-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        title="Add a stop"
        aria-label="Add a stop"
        onClick={onAdd}
      >
        <i className="fa-solid fa-plus text-xs" />
      </button>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500 dark:text-zinc-400 dark:hover:text-red-400"
        title={canRemove ? 'Remove this stop' : 'A gradient needs two stops'}
        aria-label="Remove this stop"
        disabled={!canRemove}
        onClick={onRemove}
      >
        <i className="fa-solid fa-trash-can text-xs" />
      </button>
    </div>
  </div>
);

export default GradientStopEditor;
